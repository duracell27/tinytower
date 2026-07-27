import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface GlobalStats {
  players: number;
  floors: number;
  cities: number;
}

const CACHE_TTL_MS = 60_000;

@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService) {}

  private cache: { value: GlobalStats; expiresAt: number } | null = null;

  async getGlobalStats(): Promise<GlobalStats> {
    const now = Date.now();
    if (this.cache && now < this.cache.expiresAt) {
      return this.cache.value;
    }

    const [players, floors] = await Promise.all([
      this.prisma.player.count(),
      this.prisma.floor.count(),
    ]);

    const value: GlobalStats = { players, floors, cities: 0 };
    this.cache = { value, expiresAt: now + CACHE_TTL_MS };
    return value;
  }
}
