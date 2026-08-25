import { Injectable, UnauthorizedException, ConflictException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import type { StringValue } from 'ms';
import { PlayerService } from '../player/player.service';
import { REDIS_CLIENT } from './redis.provider';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';
import type { ConvertDto } from './dto/convert.dto';

const GUEST_ADJECTIVES = ['Bold', 'Cheerful', 'Swift', 'Wise', 'Lucky', 'Brave', 'Clever', 'Happy', 'Calm', 'Eager'];
const GUEST_NOUNS = ['Builder', 'Architect', 'Owner', 'Foreman', 'Creator', 'Planner', 'Designer', 'Investor'];

@Injectable()
export class AuthService {
  private readonly refreshTtlSeconds: number;

  constructor(
    private playerService: PlayerService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {
    const ttl = this.configService.get<string>('JWT_REFRESH_TTL') || '30d';
    this.refreshTtlSeconds = this.parseTtl(ttl);
  }

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.playerService.findByEmail(email);
    if (existing) throw new ConflictException('Email already registered');

    const nameTaken = await this.playerService.findByPlayerName(dto.playerName.trim());
    if (nameTaken) throw new ConflictException('Player name already taken');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const player = await this.playerService.createWithInitialState(
      email, passwordHash, dto.playerName,
    );

    const tokens = await this.generateTokens(player.id, player.email, player.isAdmin);
    return {
      ...tokens,
      player: { id: player.id, email: player.email, playerName: player.playerName, isAdmin: player.isAdmin },
    };
  }

  async login(dto: LoginDto) {
    const player = await this.playerService.findByEmail(dto.email.toLowerCase().trim());
    if (!player) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, player.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const tokens = await this.generateTokens(player.id, player.email, player.isAdmin);
    return {
      ...tokens,
      player: { id: player.id, email: player.email, playerName: player.playerName, isAdmin: player.isAdmin },
    };
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string; jti: string };
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const key = `refresh:${payload.sub}:${payload.jti}`;
    const exists = await this.redis.exists(key);
    if (!exists) throw new UnauthorizedException('Refresh token revoked');

    await this.redis.del(key);

    const player = await this.playerService.findById(payload.sub);
    if (!player) throw new UnauthorizedException('Player not found');

    return this.generateTokens(player.id, player.email, player.isAdmin);
  }

  async registerAsGuest() {
    const playerName = await this.generateUniqueGuestName();
    const email = `g-${randomUUID().split('-')[0]}@tmp.tinytower`;
    const passwordHash = await bcrypt.hash(randomUUID(), 10);

    const player = await this.playerService.createWithInitialState(email, passwordHash, playerName, true);
    const tokens = await this.generateTokens(player.id, player.email, player.isAdmin);
    return {
      ...tokens,
      player: { id: player.id, email: player.email, playerName: player.playerName, isAdmin: player.isAdmin, isTemporary: true },
    };
  }

  async convertAccount(playerId: string, dto: ConvertDto) {
    const email = dto.email.toLowerCase().trim();
    const playerName = dto.playerName.trim();

    const existingEmail = await this.playerService.findByEmail(email);
    if (existingEmail && existingEmail.id !== playerId) throw new ConflictException('Email already registered');

    const existingName = await this.playerService.findByPlayerName(playerName);
    if (existingName && existingName.id !== playerId) throw new ConflictException('Player name already taken');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const player = await this.playerService.convertToRegistered(playerId, email, passwordHash, playerName);
    return {
      player: { id: player.id, email: player.email, playerName: player.playerName, isAdmin: player.isAdmin, isTemporary: false },
      registrationGems: 5,
    };
  }

  async logout(playerId: string) {
    const keys = await this.redis.keys(`refresh:${playerId}:*`);
    if (keys.length > 0) await this.redis.del(...keys);
  }

  private async generateUniqueGuestName(): Promise<string> {
    for (let i = 0; i < 10; i++) {
      const adj = GUEST_ADJECTIVES[Math.floor(Math.random() * GUEST_ADJECTIVES.length)];
      const noun = GUEST_NOUNS[Math.floor(Math.random() * GUEST_NOUNS.length)];
      const suffix = Math.floor(Math.random() * 9000) + 1000;
      const name = `${adj}${noun}${suffix}`;
      const existing = await this.playerService.findByPlayerName(name);
      if (!existing) return name;
    }
    return `Guest${randomUUID().slice(0, 8)}`;
  }

  private async generateTokens(playerId: string, email: string, isAdmin: boolean) {
    const jti = randomUUID();

    const accessTtl = (this.configService.get<string>('JWT_ACCESS_TTL') || '15m') as StringValue;
    const refreshTtl = (this.configService.get<string>('JWT_REFRESH_TTL') || '30d') as StringValue;

    const accessToken = this.jwtService.sign(
      { sub: playerId, email, isAdmin },
      { expiresIn: accessTtl },
    );

    const refreshToken = this.jwtService.sign(
      { sub: playerId, jti },
      { expiresIn: refreshTtl },
    );

    await this.redis.setex(`refresh:${playerId}:${jti}`, this.refreshTtlSeconds, '1');

    return { accessToken, refreshToken };
  }

  private parseTtl(ttl: string): number {
    const match = ttl.match(/^(\d+)([smhd])$/);
    if (!match) return 30 * 24 * 3600;
    const [, num, unit] = match;
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return parseInt(num) * (multipliers[unit] || 86400);
  }
}
