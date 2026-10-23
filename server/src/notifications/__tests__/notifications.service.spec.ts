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

  describe('resetNotificationStateForCommands', () => {
    it('collect command resets notifiedCollect to null', async () => {
      prisma.player.update = jest.fn().mockResolvedValue({});
      const cmds = [{ type: 'collect', id: 'c1', floorId: 1, slotIdx: 0, timestamp: 0 }] as any;
      await service.resetNotificationStateForCommands('p1', cmds);
      expect(prisma.player.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { notifiedCollect: null },
      });
    });

    it('list command resets notifiedStock to null', async () => {
      prisma.player.update = jest.fn().mockResolvedValue({});
      const cmds = [{ type: 'list', id: 'c2', floorId: 1, slotIdx: 0, timestamp: 0 }] as any;
      await service.resetNotificationStateForCommands('p1', cmds);
      expect(prisma.player.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { notifiedStock: null },
      });
    });

    it('unrelated commands do not reset any fields', async () => {
      prisma.player.update = jest.fn().mockResolvedValue({});
      const cmds = [{ type: 'claim_daily_task', id: 'c3', timestamp: 0 }] as any;
      await service.resetNotificationStateForCommands('p1', cmds);
      expect(prisma.player.update).not.toHaveBeenCalled();
    });

    it('empty command array does nothing', async () => {
      prisma.player.update = jest.fn().mockResolvedValue({});
      await service.resetNotificationStateForCommands('p1', []);
      expect(prisma.player.update).not.toHaveBeenCalled();
    });
  });
});
