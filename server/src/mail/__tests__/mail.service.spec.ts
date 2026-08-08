import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MailService } from '../mail.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('MailService', () => {
  let service: MailService;
  let prisma: Record<string, any>;

  const baseMsg = {
    id: 'msg-1',
    fromId: 'p1',
    toId: 'p2',
    subject: 'Hello',
    body: 'World',
    isRead: false,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    from: { playerName: 'Alice' },
  };

  beforeEach(async () => {
    prisma = {
      mailMessage: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue(baseMsg),
        update: jest.fn().mockResolvedValue({ ...baseMsg, isRead: true }),
        delete: jest.fn().mockResolvedValue(baseMsg),
        count: jest.fn().mockResolvedValue(0),
      },
      player: {
        findUnique: jest.fn().mockResolvedValue({ id: 'p2' }),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn().mockImplementation(async (fn: any) => fn(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [MailService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<MailService>(MailService);
  });

  describe('sendMail', () => {
    beforeEach(() => {
      prisma.player.findUnique
        .mockResolvedValueOnce({ id: 'p2' })       // target exists check
        .mockResolvedValueOnce({ balance: 200 });   // sender balance inside tx
    });

    it('creates mail and returns id on success', async () => {
      const result = await service.sendMail('p1', 'p2', 'Hello', 'World');
      expect(result).toEqual({ id: 'msg-1' });
      expect(prisma.player.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { balance: { decrement: 100 } },
      });
      expect(prisma.mailMessage.create).toHaveBeenCalledWith({
        data: { fromId: 'p1', toId: 'p2', subject: 'Hello', body: 'World' },
      });
    });

    it('throws BadRequestException when sending to yourself', async () => {
      await expect(service.sendMail('p1', 'p1', 'Hello', 'World'))
        .rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when subject exceeds 100 chars', async () => {
      await expect(service.sendMail('p1', 'p2', 'a'.repeat(101), 'body'))
        .rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when body exceeds 1000 chars', async () => {
      await expect(service.sendMail('p1', 'p2', 'subject', 'a'.repeat(1001)))
        .rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when target player does not exist', async () => {
      prisma.player.findUnique.mockReset();
      prisma.player.findUnique.mockResolvedValue(null);
      await expect(service.sendMail('p1', 'p2', 'Hello', 'World'))
        .rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when sender has insufficient balance', async () => {
      prisma.player.findUnique.mockReset();
      prisma.player.findUnique
        .mockResolvedValueOnce({ id: 'p2' })
        .mockResolvedValueOnce({ balance: 50 });
      await expect(service.sendMail('p1', 'p2', 'Hello', 'World'))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('getInbox', () => {
    it('returns mapped MailMessageDto array', async () => {
      prisma.mailMessage.findMany.mockResolvedValue([baseMsg]);
      const result = await service.getInbox('p2');
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'msg-1',
        fromId: 'p1',
        fromName: 'Alice',
        subject: 'Hello',
        body: 'World',
        isRead: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      });
    });

    it('queries with toId filter, desc order, take 50', async () => {
      await service.getInbox('p2');
      expect(prisma.mailMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { toId: 'p2' },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
      );
    });
  });

  describe('getUnreadCount', () => {
    it('returns count of unread messages', async () => {
      prisma.mailMessage.count.mockResolvedValue(3);
      const result = await service.getUnreadCount('p2');
      expect(result).toEqual({ count: 3 });
      expect(prisma.mailMessage.count).toHaveBeenCalledWith({
        where: { toId: 'p2', isRead: false },
      });
    });
  });

  describe('markRead', () => {
    it('marks unread message as read', async () => {
      prisma.mailMessage.findUnique.mockResolvedValue(baseMsg);
      const result = await service.markRead('msg-1', 'p2');
      expect(result).toEqual({ success: true });
      expect(prisma.mailMessage.update).toHaveBeenCalledWith({
        where: { id: 'msg-1' },
        data: { isRead: true },
      });
    });

    it('skips update when message is already read', async () => {
      prisma.mailMessage.findUnique.mockResolvedValue({ ...baseMsg, isRead: true });
      await service.markRead('msg-1', 'p2');
      expect(prisma.mailMessage.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when message does not exist', async () => {
      prisma.mailMessage.findUnique.mockResolvedValue(null);
      await expect(service.markRead('msg-1', 'p2')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when not the recipient', async () => {
      prisma.mailMessage.findUnique.mockResolvedValue(baseMsg);
      await expect(service.markRead('msg-1', 'p3')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteMail', () => {
    it('deletes message and returns success', async () => {
      prisma.mailMessage.findUnique.mockResolvedValue(baseMsg);
      const result = await service.deleteMail('msg-1', 'p2');
      expect(result).toEqual({ success: true });
      expect(prisma.mailMessage.delete).toHaveBeenCalledWith({ where: { id: 'msg-1' } });
    });

    it('throws NotFoundException when message does not exist', async () => {
      prisma.mailMessage.findUnique.mockResolvedValue(null);
      await expect(service.deleteMail('msg-1', 'p2')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when not the recipient', async () => {
      prisma.mailMessage.findUnique.mockResolvedValue(baseMsg);
      await expect(service.deleteMail('msg-1', 'p1')).rejects.toThrow(ForbiddenException);
    });
  });
});
