import {
  Controller, Get, Post, Patch, Delete, Query, Param,
  UseGuards, Body, BadRequestException, Req,
} from '@nestjs/common';
import { z } from 'zod';
import { ForumCategory } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

type AuthReq = { user: { playerId: string; isAdmin: boolean } };

const FORUM_CATEGORIES = ['NEWS', 'HELP', 'GENERAL', 'CITIES', 'PURCHASES'] as const;

const CreateForumPostSchema = z.object({
  category: z.enum(FORUM_CATEGORIES),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
});

const ForumPinSchema = z.object({ isPinned: z.boolean() });
const ForumCloseSchema = z.object({ isClosed: z.boolean() });

const UpdateInfoSchema = z.object({
  playerName: z.string().min(3).max(30).optional(),
  email: z.string().email().optional(),
  isAdmin: z.boolean().optional(),
  playerLevel: z.number().int().nonnegative().optional(),
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
    return this.adminService.getPlayers(Math.max(1, +page || 1), Math.min(Math.max(1, +limit || 20), 200), search);
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

  @Get('commands')
  getCommandLogs(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('playerId') playerId?: string,
    @Query('type') type?: string,
  ) {
    return this.adminService.getCommandLogs(Math.max(1, +page || 1), Math.min(Math.max(1, +limit || 50), 200), playerId, type);
  }

  @Get('forum/posts')
  getForumPosts(
    @Query('category') category: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    if (!FORUM_CATEGORIES.includes(category as any)) throw new BadRequestException('Invalid category');
    return this.adminService.getForumPosts(category as ForumCategory, Math.max(1, +page || 1), Math.min(Math.max(1, +limit || 20), 100));
  }

  @Post('forum/posts')
  async createForumPost(@Req() req: AuthReq, @Body() body: unknown) {
    const result = CreateForumPostSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.issues);
    return this.adminService.createForumPost(req.user.playerId, result.data.category as ForumCategory, result.data.title, result.data.body);
  }

  @Patch('forum/posts/:id/pin')
  pinForumPost(@Param('id') id: string, @Body() body: unknown) {
    const result = ForumPinSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.issues);
    return this.adminService.pinForumPost(id, result.data.isPinned);
  }

  @Patch('forum/posts/:id/close')
  closeForumPost(@Param('id') id: string, @Body() body: unknown) {
    const result = ForumCloseSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.issues);
    return this.adminService.closeForumPost(id, result.data.isClosed);
  }

  @Delete('forum/posts/:id')
  deleteForumPost(@Param('id') id: string) {
    return this.adminService.deleteForumPost(id);
  }

  @Get('forum/posts/:id/comments')
  getForumComments(
    @Param('id') id: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.adminService.getForumComments(id, Math.max(1, +page || 1), Math.min(Math.max(1, +limit || 50), 100));
  }

  @Delete('forum/comments/:id')
  deleteForumComment(@Param('id') id: string) {
    return this.adminService.deleteForumComment(id);
  }
}
