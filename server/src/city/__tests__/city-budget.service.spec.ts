import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CityService } from '../city.service';
import { PrismaService } from '../../prisma/prisma.service';

const PLAYER_ID = 'player-1';
const CITY_ID   = 'city-1';

// Monday 2026-09-14 00:00:00 UTC
const CURRENT_MONDAY = new Date('2026-09-14T00:00:00.000Z');
// Previous week
const LAST_MONDAY    = new Date('2026-09-07T00:00:00.000Z');

function makeMembership(overrides: Record<string, any> = {}) {
  return {
    playerId: PLAYER_ID,
    cityId: CITY_ID,
    gemsGivenThisWeek: 0,
    gemsShopBonus: 0,
    gemsWeekStart: CURRENT_MONDAY,
    ...overrides,
  };
}

function makePlayer(balance = 1000, gems = 50) {
  return {
    id: PLAYER_ID,
    balance,
    state: { gems, briks: 5, glass: 5, nails: 5, screw: 5, wood: 5, cement: 5 },
  };
}

function makeCity() {
  return {
    id: CITY_ID,
    budgetCoins: 0,
    budgetGems: 0,
    budgetBriks: 0,
    budgetGlass: 0,
    budgetNails: 0,
    budgetScrew: 0,
    budgetWood: 0,
    budgetCement: 0,
  };
}

describe('CityService — budget', () => {
  let service: CityService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      cityMembership: { findUnique: jest.fn(), update: jest.fn() },
      city: { findUnique: jest.fn(), update: jest.fn() },
      player: { findUnique: jest.fn(), update: jest.fn() },
      playerState: { update: jest.fn() },
      cityBudgetTransaction: { create: jest.fn() },
      $transaction: jest.fn((fn) => fn(prisma)),
    };

    const module = await Test.createTestingModule({
      providers: [
        CityService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(CityService);

    // Default: player is in the city
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-09-15T12:00:00.000Z').getTime());
  });

  afterEach(() => jest.restoreAllMocks());

  // ── getBudget ────────────────────────────────────────

  it('getBudget: throws ForbiddenException if player not in city', async () => {
    prisma.cityMembership.findUnique.mockResolvedValue(null);
    await expect(service.getBudget(CITY_ID, PLAYER_ID)).rejects.toThrow(ForbiddenException);
  });

  it('getBudget: throws ForbiddenException if player is in a different city', async () => {
    prisma.cityMembership.findUnique.mockResolvedValue(
      makeMembership({ cityId: 'other-city' }),
    );
    await expect(service.getBudget(CITY_ID, PLAYER_ID)).rejects.toThrow(ForbiddenException);
  });

  it('getBudget: returns budget + correct quota for current week', async () => {
    prisma.cityMembership.findUnique.mockResolvedValue(
      makeMembership({ gemsGivenThisWeek: 40, gemsShopBonus: 50, gemsWeekStart: CURRENT_MONDAY }),
    );
    prisma.city.findUnique.mockResolvedValue({ ...makeCity(), budgetGems: 40 });

    const result = await service.getBudget(CITY_ID, PLAYER_ID);

    expect(result.budgetGems).toBe(40);
    expect(result.myWeekLimit).toBe(150);  // 100 + 50
    expect(result.myRemaining).toBe(110);  // 150 - 40
    expect(new Date(result.weekResetAt).getUTCDay()).toBe(1); // next Monday
  });

  it('getBudget: resets quota if week has rolled over', async () => {
    prisma.cityMembership.findUnique.mockResolvedValue(
      makeMembership({ gemsGivenThisWeek: 80, gemsWeekStart: LAST_MONDAY }),
    );
    prisma.city.findUnique.mockResolvedValue(makeCity());

    const result = await service.getBudget(CITY_ID, PLAYER_ID);

    expect(result.myRemaining).toBe(100); // fresh week, 0 donated
  });

  // ── donate ───────────────────────────────────────────

  it('donate: throws BadRequestException if nothing to donate', async () => {
    prisma.cityMembership.findUnique.mockResolvedValue(makeMembership());
    prisma.player.findUnique.mockResolvedValue(makePlayer());
    await expect(
      service.donate(PLAYER_ID, CITY_ID, { coins: 0, gems: 0 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('donate: throws ForbiddenException if not a member', async () => {
    prisma.cityMembership.findUnique.mockResolvedValue(null);
    await expect(
      service.donate(PLAYER_ID, CITY_ID, { coins: 100 }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('donate: throws BadRequestException if not enough coins', async () => {
    prisma.cityMembership.findUnique.mockResolvedValue(makeMembership());
    prisma.player.findUnique.mockResolvedValue(makePlayer(50)); // only 50 coins
    await expect(
      service.donate(PLAYER_ID, CITY_ID, { coins: 200 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('donate: throws BadRequestException if gem limit exceeded', async () => {
    prisma.cityMembership.findUnique.mockResolvedValue(
      makeMembership({ gemsGivenThisWeek: 90, gemsWeekStart: CURRENT_MONDAY }),
    );
    prisma.player.findUnique.mockResolvedValue(makePlayer(1000, 50));
    await expect(
      service.donate(PLAYER_ID, CITY_ID, { gems: 20 }), // only 10 remaining
    ).rejects.toThrow(BadRequestException);
  });

  it('donate: deducts gems and increments membership counter', async () => {
    prisma.cityMembership.findUnique.mockResolvedValue(
      makeMembership({ gemsGivenThisWeek: 0, gemsWeekStart: CURRENT_MONDAY }),
    );
    prisma.player.findUnique.mockResolvedValue(makePlayer(1000, 50));

    await service.donate(PLAYER_ID, CITY_ID, { gems: 30 });

    expect(prisma.playerState.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ gems: { decrement: 30 } }) }),
    );
    expect(prisma.cityMembership.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ gemsGivenThisWeek: { increment: 30 } }) }),
    );
    expect(prisma.city.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ budgetGems: { increment: 30 } }) }),
    );
  });

  it('donate: resets weekly counter when new week, sets gemsWeekStart', async () => {
    prisma.cityMembership.findUnique.mockResolvedValue(
      makeMembership({ gemsGivenThisWeek: 80, gemsWeekStart: LAST_MONDAY }),
    );
    prisma.player.findUnique.mockResolvedValue(makePlayer(1000, 50));

    await service.donate(PLAYER_ID, CITY_ID, { gems: 10 });

    expect(prisma.cityMembership.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          gemsGivenThisWeek: 10,          // reset + donated
          gemsWeekStart: CURRENT_MONDAY,
        }),
      }),
    );
  });

  it('donate: deducts coins without touching gems', async () => {
    prisma.cityMembership.findUnique.mockResolvedValue(makeMembership());
    prisma.player.findUnique.mockResolvedValue(makePlayer(1000, 50));

    await service.donate(PLAYER_ID, CITY_ID, { coins: 500 });

    expect(prisma.player.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { balance: { decrement: 500 } } }),
    );
    expect(prisma.playerState.update).not.toHaveBeenCalled();
  });

  it('donate: inserts CityBudgetTransaction with type deposit', async () => {
    prisma.cityMembership.findUnique.mockResolvedValue(makeMembership());
    prisma.player.findUnique.mockResolvedValue(makePlayer(1000, 50));

    await service.donate(PLAYER_ID, CITY_ID, { coins: 100, gems: 10 });

    expect(prisma.cityBudgetTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'deposit', coins: 100, gems: 10, playerId: PLAYER_ID }),
      }),
    );
  });
});
