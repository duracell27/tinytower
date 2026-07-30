import {
  Controller, Get, Patch, Delete, Query, Param,
  UseGuards, Body, BadRequestException,
} from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

const UpdateInfoSchema = z.object({
  playerName: z.string().min(3).max(30).optional(),
  email: z.string().email().optional(),
  isAdmin: z.boolean().optional(),
  playerLevel: z.number().int().positive().optional(),
  playerXp: z.number().int().nonnegative().optional(),
});

const UpdateEconomySchema = z.object({
  balance: z.number().int().nonnegative().optional(),
  gems: z.number().int().nonnegative().optional(),
});

const UpdateMaterialsSchema = z.object({
  briks: z.number().int().nonnegative().optional(),
  glass: z.number().int().nonnegative().optional(),
  nails: z.number().int().nonnegative().optional(),
  screw: z.number().int().nonnegative().optional(),
});

const UpdateTokensSchema = z.object({
  green: z.number().int().nonnegative().optional(),
  blue: z.number().int().nonnegative().optional(),
  yellow: z.number().int().nonnegative().optional(),
  purple: z.number().int().nonnegative().optional(),
  red: z.number().int().nonnegative().optional(),
});

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('players')
  getPlayers(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
  ) {
    return this.adminService.getPlayers(+page, +limit, search);
  }

  @Get('players/:id')
  getPlayer(@Param('id') id: string) {
    return this.adminService.getPlayer(id);
  }

  @Patch('players/:id/info')
  updateInfo(@Param('id') id: string, @Body() body: unknown) {
    const result = UpdateInfoSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.issues);
    return this.adminService.updatePlayerInfo(id, result.data);
  }

  @Patch('players/:id/economy')
  updateEconomy(@Param('id') id: string, @Body() body: unknown) {
    const result = UpdateEconomySchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.issues);
    return this.adminService.updatePlayerEconomy(id, result.data);
  }

  @Patch('players/:id/materials')
  updateMaterials(@Param('id') id: string, @Body() body: unknown) {
    const result = UpdateMaterialsSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.issues);
    return this.adminService.updatePlayerMaterials(id, result.data);
  }

  @Patch('players/:id/tokens')
  updateTokens(@Param('id') id: string, @Body() body: unknown) {
    const result = UpdateTokensSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.issues);
    return this.adminService.updatePlayerTokens(id, result.data);
  }

  @Delete('players/:id/workers/:workerId')
  deleteWorker(@Param('id') playerId: string, @Param('workerId') workerId: string) {
    return this.adminService.deleteWorker(playerId, workerId);
  }

  @Delete('players/:id/floors/:floorId')
  deleteFloor(@Param('id') playerId: string, @Param('floorId') floorId: string) {
    return this.adminService.deleteFloor(playerId, +floorId);
  }

  @Delete('players/:id')
  deletePlayer(@Param('id') id: string) {
    return this.adminService.deletePlayer(id);
  }
}
