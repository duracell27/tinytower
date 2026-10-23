import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from '../notifications.service';
import { PrismaService } from '../../prisma/prisma.service';

jest.mock('expo-server-sdk', () => {
  const mockExpoInstance = {
    sendPushNotificationsAsync: jest.fn(),
  };
  const MockExpo = jest.fn(() => mockExpoInstance);
  (MockExpo as any).isExpoPushToken = jest.fn(() => true);
  return { __esModule: true, default: MockExpo };
});

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: Record<string, any>;
  let mockExpo: { sendPushNotificationsAsync: jest.Mock };

  beforeEach(async () => {
    prisma = {
      player: {
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({}),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<NotificationsService>(NotificationsService);

    // Access the mocked expo instance injected into the service
    const ExpoMock = require('expo-server-sdk').default;
    mockExpo = ExpoMock.mock.results[ExpoMock.mock.results.length - 1].value;
  });

  it('saveToken: upserts pushToken and platform on Player', async () => {
    prisma.player.update = jest.fn().mockResolvedValue({});
    await service.saveToken('player-1', 'ExponentPushToken[xxx]', 'ios');
    expect(prisma.player.update).toHaveBeenCalledWith({
      where: { id: 'player-1' },
      data: {
        pushToken: 'ExponentPushToken[xxx]',
        pushPlatform: 'ios',
        pushTokenUpdatedAt: expect.any(Date),
      },
    });
  });

  it('sendPush: sends message via Expo and returns on success', async () => {
    mockExpo.sendPushNotificationsAsync = jest.fn().mockResolvedValue([
      { status: 'ok' },
    ]);
    await service.sendPush('ExponentPushToken[abc]', 'Title', 'Body');
    expect(mockExpo.sendPushNotificationsAsync).toHaveBeenCalledWith([
      expect.objectContaining({ to: 'ExponentPushToken[abc]', title: 'Title', body: 'Body' }),
    ]);
  });

  it('sendPush: clears pushToken when DeviceNotRegistered error received', async () => {
    mockExpo.sendPushNotificationsAsync = jest.fn().mockResolvedValue([
      { status: 'error', details: { error: 'DeviceNotRegistered' } },
    ]);
    prisma.player.updateMany = jest.fn().mockResolvedValue({});
    await service.sendPush('ExponentPushToken[stale]', 'T', 'B');
    expect(prisma.player.updateMany).toHaveBeenCalledWith({
      where: { pushToken: 'ExponentPushToken[stale]' },
      data: { pushToken: null },
    });
  });

  // Helper: build minimal GameState
  function makeState(floors: Array<{ id: number; stage: string }>, workerFloorIds: number[]): any {
    return {
      floors: floors.map((f) => ({
        id: f.id,
        productions: [{ typeId: 'x', stage: f.stage as any, stageStartedAt: 0 }],
      })),
      workers: workerFloorIds.map((fid, i) => ({
        id: `w${i}`, assignedFloorId: fid, assignedSlotIdx: 0,
        name: '', female: false, floorType: '', dreamJob: '', level: 1, hairColor: '', isSpecialist: false,
      })),
    };
  }

  it('checkAndSendGameTriggers: sends collect_ready push when ≥75% floors READY_TO_COLLECT and not notified', async () => {
    const player = { pushToken: 'ExponentPushToken[t]', lastSeenAt: new Date(Date.now() - 10 * 60_000), notifiedCollect: null, notifiedStock: null, notifiedPurchase: null, notifiedAllResidents: null };
    const state = makeState(
      [{ id: 1, stage: 'READY_TO_COLLECT' }, { id: 2, stage: 'READY_TO_COLLECT' }, { id: 3, stage: 'READY_TO_COLLECT' }, { id: 4, stage: 'SELLING' }],
      [],
    );
    prisma.player.update = jest.fn().mockResolvedValue({});
    jest.spyOn(service, 'sendPush').mockResolvedValue();
    await service.checkAndSendGameTriggers('p1', player as any, state, []);
    expect(service.sendPush).toHaveBeenCalledWith('ExponentPushToken[t]', 'Vibe Tower', expect.stringContaining('collect'));
    expect(prisma.player.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ notifiedCollect: expect.any(Date) }) }));
  });

  it('checkAndSendGameTriggers: does NOT send when notifiedCollect already set', async () => {
    const player = { pushToken: 'ExponentPushToken[t]', lastSeenAt: new Date(Date.now() - 10 * 60_000), notifiedCollect: new Date(), notifiedStock: null, notifiedPurchase: null, notifiedAllResidents: null };
    const state = makeState([{ id: 1, stage: 'READY_TO_COLLECT' }, { id: 2, stage: 'READY_TO_COLLECT' }], []);
    jest.spyOn(service, 'sendPush').mockResolvedValue();
    await service.checkAndSendGameTriggers('p1', player as any, state, []);
    expect(service.sendPush).not.toHaveBeenCalled();
  });

  it('checkAndSendGameTriggers: resets notifiedCollect and re-checks when collect command present', async () => {
    const player = { pushToken: 'ExponentPushToken[t]', lastSeenAt: new Date(Date.now() - 10 * 60_000), notifiedCollect: new Date(Date.now() - 3600_000), notifiedStock: null, notifiedPurchase: null, notifiedAllResidents: null };
    const state = makeState([{ id: 1, stage: 'READY_TO_COLLECT' }, { id: 2, stage: 'READY_TO_COLLECT' }], []);
    const cmds = [{ type: 'collect', id: 'c1', floorId: 1, slotIdx: 0, timestamp: 0 }] as any;
    prisma.player.update = jest.fn().mockResolvedValue({});
    jest.spyOn(service, 'sendPush').mockResolvedValue();
    await service.checkAndSendGameTriggers('p1', player as any, state, cmds);
    // After reset, 2/2 floors = 100% → still ≥75% → push fires
    expect(service.sendPush).toHaveBeenCalled();
  });

  it('checkAndSendGameTriggers: does NOT send when lastSeenAt < 5 minutes ago', async () => {
    const player = { pushToken: 'ExponentPushToken[t]', lastSeenAt: new Date(Date.now() - 2 * 60_000), notifiedCollect: null, notifiedStock: null, notifiedPurchase: null, notifiedAllResidents: null };
    const state = makeState([{ id: 1, stage: 'READY_TO_COLLECT' }, { id: 2, stage: 'READY_TO_COLLECT' }], []);
    jest.spyOn(service, 'sendPush').mockResolvedValue();
    await service.checkAndSendGameTriggers('p1', player as any, state, []);
    expect(service.sendPush).not.toHaveBeenCalled();
  });

  it('checkAndSendGameTriggers: does NOT send when 0 opened floors (division by zero guard)', async () => {
    const player = { pushToken: 'ExponentPushToken[t]', lastSeenAt: new Date(Date.now() - 10 * 60_000), notifiedCollect: null, notifiedStock: null, notifiedPurchase: null, notifiedAllResidents: null };
    const state = makeState([], []);
    jest.spyOn(service, 'sendPush').mockResolvedValue();
    await service.checkAndSendGameTriggers('p1', player as any, state, []);
    expect(service.sendPush).not.toHaveBeenCalled();
  });

  it('checkAndSendGameTriggers: sends all_residents push when all floors have a worker', async () => {
    const player = { pushToken: 'ExponentPushToken[t]', lastSeenAt: new Date(Date.now() - 10 * 60_000), notifiedCollect: null, notifiedStock: null, notifiedPurchase: null, notifiedAllResidents: null };
    const state = makeState([{ id: 1, stage: 'SELLING' }, { id: 2, stage: 'SELLING' }], [1, 2]);
    prisma.player.update = jest.fn().mockResolvedValue({});
    jest.spyOn(service, 'sendPush').mockResolvedValue();
    await service.checkAndSendGameTriggers('p1', player as any, state, []);
    expect(service.sendPush).toHaveBeenCalledWith('ExponentPushToken[t]', 'Vibe Tower', expect.stringContaining('resident'));
  });
});
