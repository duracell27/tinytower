// server/src/players/players.controller.ts
import {
  Controller, Get, Param, Query, UseGuards,
  BadRequestException, NotFoundException,
} from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlayersService } from './players.service';

const PageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
});

const SearchSchema = z.object({
  q: z.string().min(2).max(50),
  page: z.coerce.number().int().min(1).default(1),
});

@Controller('players')
@UseGuards(JwtAuthGuard)
export class PlayersController {
  constructor(private playersService: PlayersService) {}

  @Get('online')
  async getOnline(@Query() query: unknown) {
    const parsed = PageSchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return this.playersService.getOnlinePlayers(parsed.data.page);
  }

  @Get('no-city')
  async getNoCity(@Query() query: unknown) {
    const parsed = PageSchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return this.playersService.getNoCityPlayers(parsed.data.page);
  }

  @Get('search')
  async search(@Query() query: unknown) {
    const parsed = SearchSchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return this.playersService.searchPlayers(parsed.data.q, parsed.data.page);
  }

  @Get(':id')
  async getProfile(@Param('id') id: string) {
    const profile = await this.playersService.getPlayerProfile(id);
    if (!profile) throw new NotFoundException('Player not found');
    return profile;
  }
}
