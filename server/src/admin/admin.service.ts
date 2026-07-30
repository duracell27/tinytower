import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ForumCategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const FORUM_POST_SELECT = {
  id: true, playerId: true, playerName: true, playerLevel: true,
  category: true, title: true, body: true,
  isPinned: true, isClosed: true, commentCount: true,
  createdAt: true, updatedAt: true,
} as const;

const FORUM_COMMENT_SELECT = {
  id: true, postId: true, playerId: true, playerName: true,
  playerLevel: true, body: true, createdAt: true, updatedAt: true,
} as const;

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getPlayers(page: number, limit: number, search?: string) {
    const where = search
      ? {
          OR: [
            { playerName: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [players, total] = await Promise.all([
      this.prisma.player.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: { state: { select: { gems: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.player.count({ where }),
    ]);

    return {
      data: players.map((p) => ({
        id: p.id,
        email: p.email,
        playerName: p.playerName,
        playerLevel: p.playerLevel,
        balance: p.balance,
        gems: p.state?.gems ?? 0,
        isAdmin: p.isAdmin,
        lastSeenAt: p.lastSeenAt,
        createdAt: p.createdAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getPlayer(id: string) {
    const player = await this.prisma.player.findUnique({
      where: { id },
      include: {
        state: true,
        workers: true,
        floors: {
          include: { productions: { orderBy: { slotIdx: 'asc' } } },
          orderBy: { floorId: 'asc' },
        },
        floorTypes: true,
      },
    });
    if (!player) throw new NotFoundException('Player not found');

    return {
      id: player.id,
      email: player.email,
      playerName: player.playerName,
      playerLevel: player.playerLevel,
      playerXp: player.playerXp,
      isAdmin: player.isAdmin,
      balance: player.balance,
      createdAt: player.createdAt,
      lastSeenAt: player.lastSeenAt,
      gems: player.state?.gems ?? 0,
      tools: {
        briks: player.state?.briks ?? 0,
        glass: player.state?.glass ?? 0,
        nails: player.state?.nails ?? 0,
        screw: player.state?.screw ?? 0,
      },
      tokens: {
        green: player.state?.tokenGreen ?? 0,
        blue: player.state?.tokenBlue ?? 0,
        yellow: player.state?.tokenYellow ?? 0,
        purple: player.state?.tokenPurple ?? 0,
        red: player.state?.tokenRed ?? 0,
      },
      lobbyCapacity: player.state?.lobbyCapacity ?? 10,
      hotelCapacity: player.state?.hotelCapacity ?? 10,
      elevatorLevel: player.state?.elevatorLevel ?? 1,
      workers: player.workers.map((w) => ({
        id: w.id,
        name: w.name,
        level: w.level,
        floorType: w.floorType,
        dreamJob: w.dreamJob,
        isSpecialist: w.isSpecialist,
        assignedFloorId: w.assignedFloorId,
        assignedSlotIdx: w.assignedSlotIdx,
      })),
      floors: player.floors.map((f) => {
        const ft = player.floorTypes.find((t) => t.floorId === f.floorId);
        return {
          floorId: f.floorId,
          floorType: ft?.floorType ?? null,
          productions: f.productions.map((p) => ({
            slotIdx: p.slotIdx,
            typeId: p.typeId,
            stage: p.stage,
          })),
        };
      }),
    };
  }

  async updatePlayerInfo(
    id: string,
    dto: { playerName?: string; email?: string; isAdmin?: boolean; playerLevel?: number; playerXp?: number },
  ) {
    const player = await this.prisma.player.findUnique({ where: { id } });
    if (!player) throw new NotFoundException('Player not found');
    try {
      return await this.prisma.player.update({
        where: { id },
        data: dto,
        select: { id: true, playerName: true, email: true, isAdmin: true, playerLevel: true, playerXp: true },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('Player name or email already taken');
      throw e;
    }
  }

  async updatePlayerEconomy(id: string, dto: { balance?: number; gems?: number }) {
    const player = await this.prisma.player.findUnique({ where: { id } });
    if (!player) throw new NotFoundException('Player not found');
    await Promise.all([
      dto.balance !== undefined
        ? this.prisma.player.update({ where: { id }, data: { balance: dto.balance } })
        : Promise.resolve(),
      dto.gems !== undefined
        ? this.prisma.playerState.update({ where: { playerId: id }, data: { gems: dto.gems } })
        : Promise.resolve(),
    ]);
    return { ok: true };
  }

  async updatePlayerMaterials(
    id: string,
    dto: { briks?: number; glass?: number; nails?: number; screw?: number },
  ) {
    const state = await this.prisma.playerState.findUnique({ where: { playerId: id } });
    if (!state) throw new NotFoundException('Player not found');
    await this.prisma.playerState.update({ where: { playerId: id }, data: dto });
    return { ok: true };
  }

  async updatePlayerTokens(
    id: string,
    dto: { green?: number; blue?: number; yellow?: number; purple?: number; red?: number },
  ) {
    const state = await this.prisma.playerState.findUnique({ where: { playerId: id } });
    if (!state) throw new NotFoundException('Player not found');
    await this.prisma.playerState.update({
      where: { playerId: id },
      data: {
        tokenGreen: dto.green,
        tokenBlue: dto.blue,
        tokenYellow: dto.yellow,
        tokenPurple: dto.purple,
        tokenRed: dto.red,
      },
    });
    return { ok: true };
  }

  async deleteWorker(playerId: string, workerId: string) {
    const worker = await this.prisma.worker.findFirst({ where: { id: workerId, playerId } });
    if (!worker) throw new NotFoundException('Worker not found');
    await this.prisma.worker.delete({ where: { id: workerId } });
    return { ok: true };
  }

  async deleteFloor(playerId: string, floorId: number) {
    const floor = await this.prisma.floor.findUnique({
      where: { playerId_floorId: { playerId, floorId } },
    });
    if (!floor) throw new NotFoundException('Floor not found');
    await this.prisma.floor.delete({ where: { playerId_floorId: { playerId, floorId } } });
    await this.prisma.playerFloorType.deleteMany({ where: { playerId, floorId } });
    return { ok: true };
  }

  async deletePlayer(id: string) {
    const player = await this.prisma.player.findUnique({ where: { id } });
    if (!player) throw new NotFoundException('Player not found');
    await this.prisma.player.delete({ where: { id } });
    return { ok: true };
  }

  async getForumPosts(category: ForumCategory, page: number, limit: number) {
    const [total, posts] = await Promise.all([
      this.prisma.forumPost.count({ where: { category, deletedAt: null } }),
      this.prisma.forumPost.findMany({
        where: { category, deletedAt: null },
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: FORUM_POST_SELECT,
      }),
    ]);
    return { data: posts, total, page, totalPages: Math.ceil(total / limit) };
  }

  async createForumPost(playerId: string, category: ForumCategory, title: string, body: string) {
    const player = await this.prisma.player.findUnique({ where: { id: playerId }, select: { playerName: true, playerLevel: true } });
    if (!player) throw new NotFoundException('Player not found');
    return this.prisma.forumPost.create({
      data: { playerId, playerName: player.playerName, playerLevel: player.playerLevel, category, title, body },
      select: FORUM_POST_SELECT,
    });
  }

  async pinForumPost(id: string, isPinned: boolean) {
    const post = await this.prisma.forumPost.findFirst({ where: { id, deletedAt: null } });
    if (!post) throw new NotFoundException('Post not found');
    return this.prisma.forumPost.update({ where: { id }, data: { isPinned }, select: FORUM_POST_SELECT });
  }

  async closeForumPost(id: string, isClosed: boolean) {
    const post = await this.prisma.forumPost.findFirst({ where: { id, deletedAt: null } });
    if (!post) throw new NotFoundException('Post not found');
    return this.prisma.forumPost.update({ where: { id }, data: { isClosed }, select: FORUM_POST_SELECT });
  }

  async deleteForumPost(id: string) {
    const post = await this.prisma.forumPost.findFirst({ where: { id, deletedAt: null } });
    if (!post) throw new NotFoundException('Post not found');
    await this.prisma.forumPost.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true };
  }

  async getForumComments(postId: string, page: number, limit: number) {
    const post = await this.prisma.forumPost.findFirst({ where: { id: postId, deletedAt: null } });
    if (!post) throw new NotFoundException('Post not found');
    const skip = (page - 1) * limit;
    const [total, comments] = await Promise.all([
      this.prisma.forumComment.count({ where: { postId, deletedAt: null } }),
      this.prisma.forumComment.findMany({
        where: { postId, deletedAt: null },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
        select: FORUM_COMMENT_SELECT,
      }),
    ]);
    return { data: comments, total, page, totalPages: Math.ceil(total / limit) };
  }

  async deleteForumComment(id: string) {
    const comment = await this.prisma.forumComment.findFirst({ where: { id, deletedAt: null }, select: { playerId: true, postId: true } });
    if (!comment) throw new NotFoundException('Comment not found');
    await this.prisma.$transaction([
      this.prisma.forumComment.update({ where: { id }, data: { deletedAt: new Date() } }),
      this.prisma.forumPost.update({ where: { id: comment.postId }, data: { commentCount: { decrement: 1 } } }),
    ]);
    return { ok: true };
  }

  async getCommandLogs(page: number, limit: number, playerId?: string, type?: string) {
    const where = {
      ...(playerId ? { playerId } : {}),
      ...(type ? { type } : {}),
    };

    const [logs, total] = await Promise.all([
      this.prisma.commandLog.findMany({
        where,
        orderBy: { processedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.commandLog.count({ where }),
    ]);

    const playerIds = [...new Set(logs.map((l) => l.playerId))];
    const players = playerIds.length
      ? await this.prisma.player.findMany({
          where: { id: { in: playerIds } },
          select: { id: true, playerName: true },
        })
      : [];
    const playerMap = Object.fromEntries(players.map((p) => [p.id, p.playerName]));

    return {
      data: logs.map((l) => ({
        id: l.id,
        playerId: l.playerId,
        playerName: playerMap[l.playerId] ?? 'Unknown',
        type: l.type,
        floorId: l.floorId,
        slotIdx: l.slotIdx,
        typeId: l.typeId,
        workerId: l.workerId,
        timestamp: l.timestamp.toString(),
        processedAt: l.processedAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }
}
