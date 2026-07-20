import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReferralService } from '../referral.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ReferralService', () => {
  let service: ReferralService;
  let prisma: Record<string, any>;
  let txMock: Record<string, any>;

  const REFERRAL_ID = 'ref-uuid';
  const PLAYER_ID = 'player-uuid';
  const REFERRED_ID = 'referred-uuid';

  const makeReferral = (overrides = {}) => ({
    id: REFERRAL_ID,
    referrerId: PLAYER_ID,
    referredId: REFERRED_ID,
    referredName: 'Alice',
    createdAt: new Date(),
    registeredClaimedAt: null,
    level10ReachedAt: null,
    level10ClaimedAt: null,
    level30ReachedAt: null,
    level30ClaimedAt: null,
    gemBonusEarned: 0,
    ...overrides,
  });

  beforeEach(async () => {
    txMock = {
      referral: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({}),
      },
      player: {
        update: jest.fn().mockResolvedValue({}),
      },
      playerState: {
        update: jest.fn().mockResolvedValue({}),
      },
    };

    prisma = {
      player: { findUnique: jest.fn(), update: jest.fn() },
      referral: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn(async (fn: (tx: any) => Promise<any>) => fn(txMock)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ReferralService>(ReferralService);
  });

  describe('claimMilestone registered', () => {
    it('gives 10000 coins and marks registeredClaimedAt', async () => {
      txMock.referral.findUnique.mockResolvedValue(makeReferral());

      const result = await service.claimMilestone(PLAYER_ID, REFERRAL_ID, 'registered');

      expect(result).toEqual({ coins: 10000 });
      expect(txMock.player.update).toHaveBeenCalledWith({
        where: { id: PLAYER_ID },
        data: { balance: { increment: 10000 } },
      });
      expect(txMock.referral.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ registeredClaimedAt: expect.any(Date) }) }),
      );
    });

    it('throws if already claimed', async () => {
      txMock.referral.findUnique.mockResolvedValue(makeReferral({ registeredClaimedAt: new Date() }));

      await expect(
        service.claimMilestone(PLAYER_ID, REFERRAL_ID, 'registered'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('claimMilestone level10', () => {
    it('gives 20 gems when level10ReachedAt is set', async () => {
      txMock.referral.findUnique.mockResolvedValue(makeReferral({ level10ReachedAt: new Date() }));

      const result = await service.claimMilestone(PLAYER_ID, REFERRAL_ID, 'level10');

      expect(result).toEqual({ gems: 20 });
      expect(txMock.playerState.update).toHaveBeenCalledWith({
        where: { playerId: PLAYER_ID },
        data: { gems: { increment: 20 } },
      });
    });

    it('throws if milestone not yet reached', async () => {
      txMock.referral.findUnique.mockResolvedValue(makeReferral({ level10ReachedAt: null }));

      await expect(
        service.claimMilestone(PLAYER_ID, REFERRAL_ID, 'level10'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws if already claimed', async () => {
      txMock.referral.findUnique.mockResolvedValue(
        makeReferral({ level10ReachedAt: new Date(), level10ClaimedAt: new Date() }),
      );

      await expect(
        service.claimMilestone(PLAYER_ID, REFERRAL_ID, 'level10'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('claimMilestone level30', () => {
    it('gives 50 gems when level30ReachedAt is set', async () => {
      txMock.referral.findUnique.mockResolvedValue(makeReferral({ level30ReachedAt: new Date() }));

      const result = await service.claimMilestone(PLAYER_ID, REFERRAL_ID, 'level30');

      expect(result).toEqual({ gems: 50 });
      expect(txMock.playerState.update).toHaveBeenCalledWith({
        where: { playerId: PLAYER_ID },
        data: { gems: { increment: 50 } },
      });
    });

    it('throws if milestone not yet reached', async () => {
      txMock.referral.findUnique.mockResolvedValue(makeReferral({ level30ReachedAt: null }));

      await expect(
        service.claimMilestone(PLAYER_ID, REFERRAL_ID, 'level30'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('claimMilestone auth', () => {
    it('throws NotFoundException if referral belongs to different player', async () => {
      txMock.referral.findUnique.mockResolvedValue(makeReferral({ referrerId: 'other-player' }));

      await expect(
        service.claimMilestone(PLAYER_ID, REFERRAL_ID, 'registered'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPlayerReferral hasUsedCode', () => {
    it('returns hasUsedCode: true when referral with referredId exists', async () => {
      prisma.player.findUnique.mockResolvedValue({ referralCode: 'ABC123' });
      prisma.referral.findUnique.mockResolvedValue({ id: 'some-ref' });
      prisma.referral.findMany.mockResolvedValue([]);

      const result = await service.getPlayerReferral(PLAYER_ID);

      expect(result.hasUsedCode).toBe(true);
    });

    it('returns hasUsedCode: false when no referral with referredId', async () => {
      prisma.player.findUnique.mockResolvedValue({ referralCode: 'ABC123' });
      prisma.referral.findUnique.mockResolvedValue(null);
      prisma.referral.findMany.mockResolvedValue([]);

      const result = await service.getPlayerReferral(PLAYER_ID);

      expect(result.hasUsedCode).toBe(false);
    });
  });

  describe('applyReferralCode', () => {
    const REFERRER_ID = 'referrer-uuid';
    const CODE = 'ABC123';

    it('creates referral in tx, grants reward, returns { ok, coins, gems }', async () => {
      const LEVEL = 15;
      prisma.player.findUnique
        .mockResolvedValueOnce({ id: REFERRER_ID })
        .mockResolvedValueOnce({ playerName: 'TestPlayer', playerLevel: LEVEL });
      prisma.referral.findUnique.mockResolvedValue(null);

      const result = await service.applyReferralCode(PLAYER_ID, CODE);

      expect(result).toEqual({ ok: true, coins: 15_000, gems: 20 });
      expect(txMock.referral.create).toHaveBeenCalledWith({
        data: { referrerId: REFERRER_ID, referredId: PLAYER_ID, referredName: 'TestPlayer' },
      });
      expect(txMock.player.update).toHaveBeenCalledWith({
        where: { id: PLAYER_ID },
        data: { balance: { increment: 15_000 } },
      });
      expect(txMock.playerState.update).toHaveBeenCalledWith({
        where: { playerId: PLAYER_ID },
        data: { gems: { increment: 20 } },
      });
    });

    it('applies gems floor of 20 for low-level players', async () => {
      prisma.player.findUnique
        .mockResolvedValueOnce({ id: REFERRER_ID })
        .mockResolvedValueOnce({ playerName: 'Newbie', playerLevel: 5 });
      prisma.referral.findUnique.mockResolvedValue(null);

      const result = await service.applyReferralCode(PLAYER_ID, CODE);

      expect(result).toEqual({ ok: true, coins: 5_000, gems: 20 });
    });

    it('throws BadRequestException if code does not exist', async () => {
      prisma.player.findUnique.mockResolvedValue(null);

      await expect(service.applyReferralCode(PLAYER_ID, CODE)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if player uses their own code', async () => {
      prisma.player.findUnique.mockResolvedValue({ id: PLAYER_ID });

      await expect(service.applyReferralCode(PLAYER_ID, CODE)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if referral code already used', async () => {
      prisma.player.findUnique.mockResolvedValue({ id: REFERRER_ID });
      prisma.referral.findUnique.mockResolvedValue(makeReferral());

      await expect(service.applyReferralCode(PLAYER_ID, CODE)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if DB unique constraint fires (race condition)', async () => {
      prisma.player.findUnique
        .mockResolvedValueOnce({ id: REFERRER_ID })
        .mockResolvedValueOnce({ playerName: 'TestPlayer', playerLevel: 10 });
      prisma.referral.findUnique.mockResolvedValue(null);
      txMock.referral.create.mockRejectedValue({ code: 'P2002' });

      await expect(service.applyReferralCode(PLAYER_ID, CODE)).rejects.toThrow(BadRequestException);
    });
  });
});
