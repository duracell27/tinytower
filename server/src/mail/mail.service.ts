import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface MailMessageDto {
  id: string;
  fromId: string;
  fromName: string;
  subject: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

@Injectable()
export class MailService {
  constructor(private prisma: PrismaService) {}

  async sendMail(fromId: string, toId: string, subject: string, body: string): Promise<{ id: string }> {
    if (fromId === toId) throw new BadRequestException('Cannot send mail to yourself');
    if (!subject.trim().length) throw new BadRequestException('Subject cannot be empty');
    if (!body.trim().length) throw new BadRequestException('Message cannot be empty');
    if (subject.length > 100) throw new BadRequestException('Subject too long');
    if (body.length > 1000) throw new BadRequestException('Body too long');

    const target = await this.prisma.player.findUnique({ where: { id: toId }, select: { id: true } });
    if (!target) throw new NotFoundException('Player not found');

    const msg = await this.prisma.$transaction(async (tx) => {
      const sender = await tx.player.findUnique({ where: { id: fromId }, select: { balance: true } });
      if (!sender || sender.balance < 100) throw new BadRequestException('Insufficient balance');
      await tx.player.update({ where: { id: fromId }, data: { balance: { decrement: 100 } } });
      return tx.mailMessage.create({ data: { fromId, toId, subject, body } });
    });

    return { id: msg.id };
  }

  async getInbox(myId: string): Promise<MailMessageDto[]> {
    const messages = await this.prisma.mailMessage.findMany({
      where: { toId: myId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { from: { select: { playerName: true } } },
    });
    return messages.map((m) => ({
      id: m.id,
      fromId: m.fromId,
      fromName: m.from.playerName,
      subject: m.subject,
      body: m.body,
      isRead: m.isRead,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  async getUnreadCount(myId: string): Promise<{ count: number }> {
    const count = await this.prisma.mailMessage.count({ where: { toId: myId, isRead: false } });
    return { count };
  }

  async markRead(msgId: string, myId: string): Promise<{ success: true }> {
    const msg = await this.prisma.mailMessage.findUnique({ where: { id: msgId } });
    if (!msg) throw new NotFoundException('Message not found');
    if (msg.toId !== myId) throw new ForbiddenException('Not your message');
    if (!msg.isRead) {
      await this.prisma.mailMessage.update({ where: { id: msgId }, data: { isRead: true } });
    }
    return { success: true } as const;
  }

  async deleteMail(msgId: string, myId: string): Promise<{ success: true }> {
    const msg = await this.prisma.mailMessage.findUnique({ where: { id: msgId } });
    if (!msg) throw new NotFoundException('Message not found');
    if (msg.toId !== myId) throw new ForbiddenException('Not your message');
    await this.prisma.mailMessage.delete({ where: { id: msgId } });
    return { success: true } as const;
  }
}
