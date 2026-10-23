import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from '../notifications.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: Record<string, any>;

  beforeEach(async () => {
    prisma = {
      player: {
        update: jest.fn().mockResolvedValue({}),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<NotificationsService>(NotificationsService);
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
});
