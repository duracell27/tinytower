import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma, ReportCategory, ReportTargetType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportService {
  constructor(private prisma: PrismaService) {}

  private async findTarget(tx: Prisma.TransactionClient | PrismaService, targetType: ReportTargetType, targetId: string) {
    if (targetType === 'CHAT_MESSAGE') {
      return tx.chatMessage.findFirst({ where: { id: targetId, deletedAt: null }, select: { id: true } });
    }
    if (targetType === 'FORUM_POST') {
      return tx.forumPost.findFirst({ where: { id: targetId, deletedAt: null }, select: { id: true } });
    }
    return tx.forumComment.findFirst({ where: { id: targetId, deletedAt: null }, select: { id: true } });
  }

  private async incrementCount(tx: Prisma.TransactionClient, targetType: ReportTargetType, targetId: string) {
    const data = { reportCount: { increment: 1 } };
    const select = { reportCount: true };
    if (targetType === 'CHAT_MESSAGE') return tx.chatMessage.update({ where: { id: targetId }, data, select });
    if (targetType === 'FORUM_POST') return tx.forumPost.update({ where: { id: targetId }, data, select });
    return tx.forumComment.update({ where: { id: targetId }, data, select });
  }

  private async setHidden(tx: Prisma.TransactionClient, targetType: ReportTargetType, targetId: string) {
    const data = { isHidden: true };
    if (targetType === 'CHAT_MESSAGE') return tx.chatMessage.update({ where: { id: targetId }, data });
    if (targetType === 'FORUM_POST') return tx.forumPost.update({ where: { id: targetId }, data });
    return tx.forumComment.update({ where: { id: targetId }, data });
  }

  async createReport(reporterId: string, targetType: ReportTargetType, targetId: string, category: ReportCategory) {
    const target = await this.findTarget(this.prisma, targetType, targetId);
    if (!target) throw new NotFoundException('Content not found');

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.report.create({ data: { reporterId, targetType, targetId, category } });
        const updated = await this.incrementCount(tx, targetType, targetId);
        if (updated.reportCount >= 5) {
          await this.setHidden(tx, targetType, targetId);
        }
      });
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === 'P2002') throw new ConflictException('Already reported');
      throw e;
    }
    return { ok: true as const };
  }

  async getReports(page: number, limit: number) {
    const [chatMsgs, forumPosts, forumComments] = await Promise.all([
      this.prisma.chatMessage.findMany({
        where: { reportCount: { gt: 0 }, deletedAt: null },
        select: { id: true, playerName: true, body: true, reportCount: true, createdAt: true },
      }),
      this.prisma.forumPost.findMany({
        where: { reportCount: { gt: 0 }, deletedAt: null },
        select: { id: true, playerName: true, title: true, body: true, reportCount: true, createdAt: true },
      }),
      this.prisma.forumComment.findMany({
        where: { reportCount: { gt: 0 }, deletedAt: null },
        select: { id: true, playerName: true, body: true, reportCount: true, createdAt: true },
      }),
    ]);

    const all = [
      ...chatMsgs.map(m => ({
        targetType: 'CHAT_MESSAGE' as const, targetId: m.id,
        playerName: m.playerName, preview: m.body.slice(0, 80),
        reportCount: m.reportCount, createdAt: m.createdAt,
      })),
      ...forumPosts.map(p => ({
        targetType: 'FORUM_POST' as const, targetId: p.id,
        playerName: p.playerName, preview: `${p.title}: ${p.body}`.slice(0, 80),
        reportCount: p.reportCount, createdAt: p.createdAt,
      })),
      ...forumComments.map(c => ({
        targetType: 'FORUM_COMMENT' as const, targetId: c.id,
        playerName: c.playerName, preview: c.body.slice(0, 80),
        reportCount: c.reportCount, createdAt: c.createdAt,
      })),
    ];

    all.sort((a, b) => b.reportCount - a.reportCount);
    const total = all.length;
    const skip = (page - 1) * limit;
    const pageData = all.slice(skip, skip + limit);

    if (pageData.length === 0) {
      return { data: [], total, page, totalPages: Math.ceil(total / limit) };
    }

    const targetIds = pageData.map(item => item.targetId);
    const reports = await this.prisma.report.findMany({
      where: { targetId: { in: targetIds } },
      select: { targetId: true, category: true },
    });

    const categoryMap = new Map<string, Record<string, number>>();
    for (const r of reports) {
      if (!categoryMap.has(r.targetId)) categoryMap.set(r.targetId, {});
      const cats = categoryMap.get(r.targetId)!;
      cats[r.category] = (cats[r.category] ?? 0) + 1;
    }

    return {
      data: pageData.map(item => ({ ...item, categories: categoryMap.get(item.targetId) ?? {} })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getReportDetail(targetType: ReportTargetType, targetId: string) {
    let content: { playerName: string; body: string; title?: string } | null = null;
    if (targetType === 'CHAT_MESSAGE') {
      content = await this.prisma.chatMessage.findUnique({ where: { id: targetId }, select: { playerName: true, body: true } });
    } else if (targetType === 'FORUM_POST') {
      content = await this.prisma.forumPost.findUnique({ where: { id: targetId }, select: { playerName: true, title: true, body: true } });
    } else {
      content = await this.prisma.forumComment.findUnique({ where: { id: targetId }, select: { playerName: true, body: true } });
    }
    if (!content) throw new NotFoundException('Content not found');

    const reports = await this.prisma.report.findMany({
      where: { targetType, targetId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, category: true, createdAt: true, reporter: { select: { playerName: true } } },
    });

    return { targetType, targetId, content, reports };
  }

  async dismissReports(targetType: ReportTargetType, targetId: string) {
    const data = { reportCount: 0, isHidden: false };
    await this.prisma.$transaction(async (tx) => {
      if (targetType === 'CHAT_MESSAGE') await tx.chatMessage.update({ where: { id: targetId }, data });
      else if (targetType === 'FORUM_POST') await tx.forumPost.update({ where: { id: targetId }, data });
      else await tx.forumComment.update({ where: { id: targetId }, data });
      await tx.report.deleteMany({ where: { targetType, targetId } });
    });
    return { ok: true as const };
  }

  async deleteReportedContent(targetType: ReportTargetType, targetId: string) {
    const deletedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      const data = { deletedAt, reportCount: 0, isHidden: false };
      if (targetType === 'CHAT_MESSAGE') await tx.chatMessage.update({ where: { id: targetId }, data });
      else if (targetType === 'FORUM_POST') await tx.forumPost.update({ where: { id: targetId }, data });
      else await tx.forumComment.update({ where: { id: targetId }, data });
      await tx.report.deleteMany({ where: { targetType, targetId } });
    });
    return { ok: true as const };
  }
}
