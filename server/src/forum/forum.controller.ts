import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  Query, UseGuards, Req, BadRequestException,
} from '@nestjs/common';
import { z } from 'zod';
import { ForumCategory } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from './admin.guard';
import { ForumService } from './forum.service';

const CATEGORIES = ['NEWS', 'HELP', 'GENERAL', 'CITIES', 'PURCHASES'] as const;
const CategorySchema = z.enum(CATEGORIES);

const CreatePostSchema = z.object({
  category: CategorySchema,
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
});

const UpdatePostSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
});

const CreateCommentSchema = z.object({
  body: z.string().min(1).max(1000),
});

const PinSchema = z.object({ isPinned: z.boolean() });
const CloseSchema = z.object({ isClosed: z.boolean() });

type AuthReq = { user: { playerId: string; isAdmin: boolean } };

@Controller('forum')
export class ForumController {
  constructor(private forumService: ForumService) {}

  @Get('unread')
  @UseGuards(JwtAuthGuard)
  getUnread(@Req() req: AuthReq) {
    return this.forumService.getUnreadCounts(req.user.playerId);
  }

  @Get('posts')
  @UseGuards(JwtAuthGuard)
  async getPosts(
    @Query('category') category: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Req() req: AuthReq,
  ) {
    const parsed = CategorySchema.safeParse(category);
    if (!parsed.success) throw new BadRequestException('Invalid category');
    return this.forumService.getPosts(
      parsed.data,
      parseInt(page, 10),
      Math.min(parseInt(limit, 10), 20),
      req.user.playerId,
    );
  }

  @Post('posts')
  @UseGuards(JwtAuthGuard)
  async createPost(@Req() req: AuthReq, @Body() body: unknown) {
    const parsed = CreatePostSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    const post = await this.forumService.createPost(
      req.user.playerId,
      parsed.data.category,
      parsed.data.title,
      parsed.data.body,
      req.user.isAdmin,
    );
    return { post };
  }

  @Get('posts/:id')
  @UseGuards(JwtAuthGuard)
  async getPost(@Param('id') id: string, @Req() req: AuthReq) {
    return { post: await this.forumService.getPost(id, req.user.playerId) };
  }

  @Patch('posts/:id')
  @UseGuards(JwtAuthGuard)
  async updatePost(@Param('id') id: string, @Req() req: AuthReq, @Body() body: unknown) {
    const parsed = UpdatePostSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return { post: await this.forumService.updatePost(id, parsed.data.title, parsed.data.body, req.user.playerId, req.user.isAdmin) };
  }

  @Delete('posts/:id')
  @UseGuards(JwtAuthGuard)
  deletePost(@Param('id') id: string, @Req() req: AuthReq) {
    return this.forumService.deletePost(id, req.user.playerId, req.user.isAdmin);
  }

  @Patch('posts/:id/pin')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async pinPost(@Param('id') id: string, @Req() req: AuthReq, @Body() body: unknown) {
    const parsed = PinSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return { post: await this.forumService.pinPost(id, parsed.data.isPinned, req.user.playerId) };
  }

  @Patch('posts/:id/close')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async closePost(@Param('id') id: string, @Req() req: AuthReq, @Body() body: unknown) {
    const parsed = CloseSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return { post: await this.forumService.closePost(id, parsed.data.isClosed, req.user.playerId) };
  }

  @Post('posts/:id/read')
  @UseGuards(JwtAuthGuard)
  markRead(@Param('id') id: string, @Req() req: AuthReq) {
    return this.forumService.markRead(req.user.playerId, id);
  }

  @Get('posts/:id/comments')
  @UseGuards(JwtAuthGuard)
  async getComments(
    @Param('id') id: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.forumService.getComments(id, parseInt(page, 10), Math.min(parseInt(limit, 10), 50));
  }

  @Post('posts/:id/comments')
  @UseGuards(JwtAuthGuard)
  async createComment(@Param('id') id: string, @Req() req: AuthReq, @Body() body: unknown) {
    const parsed = CreateCommentSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return { comment: await this.forumService.createComment(req.user.playerId, id, parsed.data.body) };
  }

  @Patch('comments/:id')
  @UseGuards(JwtAuthGuard)
  async updateComment(@Param('id') id: string, @Req() req: AuthReq, @Body() body: unknown) {
    const parsed = CreateCommentSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return { comment: await this.forumService.updateComment(id, parsed.data.body, req.user.playerId, req.user.isAdmin) };
  }

  @Delete('comments/:id')
  @UseGuards(JwtAuthGuard)
  deleteComment(@Param('id') id: string, @Req() req: AuthReq) {
    return this.forumService.deleteComment(id, req.user.playerId, req.user.isAdmin);
  }
}
