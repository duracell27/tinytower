import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { FriendRequestStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface FriendStatusDto {
  status: 'none' | 'pending_sent' | 'pending_received' | 'friends';
  requestId?: string;
}

export interface FriendEntryDto {
  requestId: string;
  playerId: string;
  playerName: string;
  playerLevel: number;
  city: string | null;
  lastSeenAt: string;
}

export interface IncomingRequestDto {
  requestId: string;
  fromId: string;
  playerName: string;
  playerLevel: number;
  city: string | null;
  createdAt: string;
}

@Injectable()
export class FriendsService {
  constructor(private prisma: PrismaService) {}

  private async findAnyRequest(playerAId: string, playerBId: string) {
    return this.prisma.friendRequest.findFirst({
      where: {
        OR: [
          { fromId: playerAId, toId: playerBId },
          { fromId: playerBId, toId: playerAId },
        ],
      },
    });
  }

  async getStatus(myId: string, otherId: string): Promise<FriendStatusDto> {
    if (myId === otherId) return { status: 'none' };
    const req = await this.findAnyRequest(myId, otherId);
    if (!req) return { status: 'none' };
    if (req.status === FriendRequestStatus.ACCEPTED) return { status: 'friends', requestId: req.id };
    if (req.status === FriendRequestStatus.PENDING) {
      return req.fromId === myId
        ? { status: 'pending_sent', requestId: req.id }
        : { status: 'pending_received', requestId: req.id };
    }
    return { status: 'none' };
  }

  async sendRequest(fromId: string, toId: string): Promise<{ requestId: string }> {
    const target = await this.prisma.player.findUnique({ where: { id: toId }, select: { id: true } });
    if (!target) throw new NotFoundException('Player not found');
    if (fromId === toId) throw new BadRequestException('Cannot send request to yourself');
    const existing = await this.findAnyRequest(fromId, toId);
    if (existing) {
      if (existing.status === FriendRequestStatus.ACCEPTED) throw new BadRequestException('Already friends');
      if (existing.status === FriendRequestStatus.PENDING) throw new BadRequestException('Request already pending');
      if (existing.fromId === fromId && existing.status === FriendRequestStatus.REJECTED) {
        const updated = await this.prisma.friendRequest.update({
          where: { id: existing.id },
          data: { status: FriendRequestStatus.PENDING },
        });
        return { requestId: updated.id };
      }
      throw new BadRequestException('already_exists');
    }
    const req = await this.prisma.friendRequest.create({
      data: { fromId, toId, status: FriendRequestStatus.PENDING },
    });
    return { requestId: req.id };
  }

  async cancelRequest(requestId: string, myId: string): Promise<{ success: true }> {
    const req = await this.prisma.friendRequest.findUnique({ where: { id: requestId } });
    if (!req) throw new NotFoundException('Request not found');
    if (req.fromId !== myId) throw new ForbiddenException('Not your request');
    if (req.status !== FriendRequestStatus.PENDING) throw new BadRequestException('Request is not pending');
    await this.prisma.friendRequest.delete({ where: { id: requestId } });
    return { success: true } as const;
  }

  async acceptRequest(requestId: string, myId: string): Promise<{ success: true }> {
    const req = await this.prisma.friendRequest.findUnique({ where: { id: requestId } });
    if (!req) throw new NotFoundException('Request not found');
    if (req.toId !== myId) throw new ForbiddenException('Not your request to accept');
    if (req.status !== FriendRequestStatus.PENDING) throw new BadRequestException('Request is not pending');
    await this.prisma.friendRequest.update({ where: { id: requestId }, data: { status: FriendRequestStatus.ACCEPTED } });
    return { success: true } as const;
  }

  async rejectRequest(requestId: string, myId: string): Promise<{ success: true }> {
    const req = await this.prisma.friendRequest.findUnique({ where: { id: requestId } });
    if (!req) throw new NotFoundException('Request not found');
    if (req.toId !== myId) throw new ForbiddenException('Not your request to reject');
    if (req.status !== FriendRequestStatus.PENDING) throw new BadRequestException('Request is not pending');
    await this.prisma.friendRequest.update({ where: { id: requestId }, data: { status: FriendRequestStatus.REJECTED } });
    return { success: true } as const;
  }

  async removeFriend(requestId: string, myId: string): Promise<{ success: true }> {
    const req = await this.prisma.friendRequest.findUnique({ where: { id: requestId } });
    if (!req) throw new NotFoundException('Friendship not found');
    if (req.fromId !== myId && req.toId !== myId) throw new ForbiddenException('Not your friendship');
    if (req.status !== FriendRequestStatus.ACCEPTED) throw new BadRequestException('Not friends');
    await this.prisma.friendRequest.delete({ where: { id: requestId } });
    return { success: true } as const;
  }

  async getFriends(myId: string): Promise<FriendEntryDto[]> {
    const requests = await this.prisma.friendRequest.findMany({
      where: { status: FriendRequestStatus.ACCEPTED, OR: [{ fromId: myId }, { toId: myId }] },
    });
    const friendIds = requests.map(r => (r.fromId === myId ? r.toId : r.fromId));
    const requestIdMap = new Map(requests.map(r => [r.fromId === myId ? r.toId : r.fromId, r.id]));
    const players = await this.prisma.player.findMany({
      where: { id: { in: friendIds } },
      select: { id: true, playerName: true, playerLevel: true, city: true, lastSeenAt: true },
    });
    return players.map(p => ({
      requestId: requestIdMap.get(p.id)!,
      playerId: p.id,
      playerName: p.playerName,
      playerLevel: p.playerLevel,
      city: p.city,
      lastSeenAt: p.lastSeenAt.toISOString(),
    }));
  }

  async getIncomingRequests(myId: string): Promise<IncomingRequestDto[]> {
    const requests = await this.prisma.friendRequest.findMany({
      where: { toId: myId, status: FriendRequestStatus.PENDING },
      include: {
        from: { select: { id: true, playerName: true, playerLevel: true, city: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return requests.map(r => ({
      requestId: r.id,
      fromId: r.fromId,
      playerName: r.from.playerName,
      playerLevel: r.from.playerLevel,
      city: r.from.city,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
