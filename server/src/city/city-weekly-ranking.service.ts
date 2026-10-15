import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { currentWeekStart, computeWeeklyReward, computeResourceReward, generateRandomResources } from './city-task.constants';

function mondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0=Sun
  const daysToMonday = day === 0 ? 6 : day - 1;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - daysToMonday));
}

function fmtWeekTitle(weekStart: Date): string {
  const fri = new Date(weekStart.getTime() + 4 * 86_400_000);
  const dd = (d: Date) => String(d.getUTCDate()).padStart(2, '0');
  const mm = String(fri.getUTCMonth() + 1).padStart(2, '0');
  const yy = String(fri.getUTCFullYear()).slice(-2);
  return `City Tournament ${dd(weekStart)}-${dd(fri)}.${mm}.${yy}`;
}

function isWeekClosed(weekStart: Date): boolean {
  // A week (Mon–Fri) is closed when the Saturday of that week has begun (≥ weekStart + 5 days)
  const saturdayStart = new Date(weekStart.getTime() + 5 * 86_400_000);
  return new Date() >= saturdayStart;
}

export interface WeekSummary {
  weekStart: string;
  status: 'CURRENT' | 'PENDING' | 'OVERDUE' | 'APPROVED';
  rankingId?: string;
}

@Injectable()
export class CityWeeklyRankingService {
  constructor(private prisma: PrismaService) {}

  // Returns last 8 weeks (oldest first) with statuses
  async listWeeks(): Promise<WeekSummary[]> {
    const now = new Date();
    const thisWeek = currentWeekStart();

    // Collect weeks: this week + 7 previous
    const weeks: Date[] = [];
    for (let i = 7; i >= 0; i--) {
      weeks.push(new Date(thisWeek.getTime() - i * 7 * 86_400_000));
    }

    const rankings = await this.prisma.cityWeeklyRanking.findMany({
      where: { weekStart: { in: weeks } },
      select: { id: true, weekStart: true, status: true },
    });
    const rankingMap = new Map(rankings.map((r) => [r.weekStart.toISOString(), r]));

    return weeks.map((weekStart) => {
      const key = weekStart.toISOString();
      const ranking = rankingMap.get(key);
      const isCurrent = weekStart.getTime() === thisWeek.getTime();

      let status: WeekSummary['status'];
      if (ranking?.status === 'APPROVED') {
        status = 'APPROVED';
      } else if (isCurrent) {
        status = 'CURRENT';
      } else if (isWeekClosed(weekStart)) {
        status = ranking ? 'PENDING' : 'OVERDUE';
      } else {
        status = 'CURRENT';
      }

      return { weekStart: weekStart.toISOString(), status, rankingId: ranking?.id };
    });
  }

  async previewRanking(weekStartIso: string) {
    const weekStart = new Date(weekStartIso);
    if (isNaN(weekStart.getTime())) throw new BadRequestException('Invalid weekStart');

    const stats = await this.prisma.cityWeeklyStats.findMany({
      where: { weekStart },
      include: { city: { select: { id: true, name: true } } },
      orderBy: { totalTickets: 'desc' },
    });

    return stats.map((s, idx) => {
      const rank = idx + 1;
      const rewards = computeWeeklyReward(s.totalTickets, rank);
      const resourceReward = computeResourceReward(s.totalTickets, rank);
      return { cityId: s.cityId, cityName: s.city.name, rank, totalTickets: s.totalTickets, resourceReward, ...rewards };
    });
  }

  async approveRanking(adminPlayerId: string, weekStartIso: string) {
    const weekStart = new Date(weekStartIso);
    if (isNaN(weekStart.getTime())) throw new BadRequestException('Invalid weekStart');
    if (!isWeekClosed(weekStart)) throw new BadRequestException('Week is not closed yet (Mon–Fri must all have passed)');

    // Prevent double-approval
    const existing = await this.prisma.cityWeeklyRanking.findUnique({ where: { weekStart } });
    if (existing?.status === 'APPROVED') throw new BadRequestException('Ranking already approved');

    const [stats, admin] = await Promise.all([
      this.prisma.cityWeeklyStats.findMany({
        where: { weekStart },
        include: { city: { select: { name: true } } },
        orderBy: { totalTickets: 'desc' },
      }),
      this.prisma.player.findUnique({
        where: { id: adminPlayerId },
        select: { playerName: true, playerLevel: true },
      }),
    ]);

    if (stats.length === 0) throw new BadRequestException('No ticket data for this week');

    const entries = stats.map((s, idx) => {
      const rank = idx + 1;
      const resourceReward = computeResourceReward(s.totalTickets, rank);
      return { cityId: s.cityId, cityName: (s as any).city?.name ?? s.cityId, rank, totalTickets: s.totalTickets, resourceReward, ...computeWeeklyReward(s.totalTickets, rank) };
    });

    await this.prisma.$transaction(async (tx) => {
      const ranking = await tx.cityWeeklyRanking.upsert({
        where: { weekStart },
        create: { weekStart, status: 'APPROVED', approvedBy: adminPlayerId, approvedAt: new Date() },
        update: { status: 'APPROVED', approvedBy: adminPlayerId, approvedAt: new Date() },
      });

      // Upsert entries
      for (const e of entries) {
        await tx.cityWeeklyRankingEntry.upsert({
          where: { rankingId_cityId: { rankingId: ranking.id, cityId: e.cityId } },
          create: { rankingId: ranking.id, ...e },
          update: { rank: e.rank, totalTickets: e.totalTickets, baseReward: e.baseReward, placementBonus: e.placementBonus, superBonus: e.superBonus, totalReward: e.totalReward, resourceReward: e.resourceReward },
        });

        // Add gems + resources to city budget
        const resources = generateRandomResources(e.resourceReward);
        await tx.city.update({
          where: { id: e.cityId },
          data: {
            budgetGems:   { increment: e.totalReward },
            budgetBriks:  { increment: resources.briks },
            budgetGlass:  { increment: resources.glass },
            budgetNails:  { increment: resources.nails },
            budgetScrew:  { increment: resources.screw },
            budgetWood:   { increment: resources.wood },
            budgetCement: { increment: resources.cement },
          },
        });

        // Create/update CityWeeklyResult for client display
        await tx.cityWeeklyResult.upsert({
          where: { cityId_weekStart: { cityId: e.cityId, weekStart } },
          create: {
            cityId: e.cityId, weekStart, createdBy: adminPlayerId,
            rank: e.rank, totalTickets: e.totalTickets, totalReward: e.totalReward,
          },
          update: { rank: e.rank, totalTickets: e.totalTickets, totalReward: e.totalReward, createdBy: adminPlayerId },
        });
      }
      const medals = ['🥇', '🥈', '🥉'];
      const top10 = entries.slice(0, 10);
      const top10Lines = top10
        .map((e, i) => {
          const prefix = medals[i] ?? `#${i + 1}`;
          return `${prefix} ${e.cityName} — ${e.totalTickets} 🎫 (+${e.totalReward} 💎)`;
        })
        .join('\n');

      const postTitle = fmtWeekTitle(weekStart);
      const postBody =
        `🏙️ The City Tournament has ended! Congratulations to all participating cities.\n\n` +
        `🔝 Top ${top10.length}:\n${top10Lines}\n\n` +
        `Rewards have been added to city budgets.`;

      await tx.forumPost.create({
        data: {
          playerId: adminPlayerId,
          playerName: admin?.playerName ?? 'Admin',
          playerLevel: admin?.playerLevel ?? 1,
          category: 'NEWS',
          title: postTitle,
          body: postBody,
          isPinned: false,
          isClosed: false,
        },
      });
    });

    return { approved: entries.length };
  }

  async getRankingDetail(weekStartIso: string) {
    const weekStart = new Date(weekStartIso);
    const ranking = await this.prisma.cityWeeklyRanking.findUnique({
      where: { weekStart },
      include: {
        entries: {
          include: { city: { select: { id: true, name: true } } },
          orderBy: { rank: 'asc' },
        },
      },
    });
    return ranking;
  }
}
