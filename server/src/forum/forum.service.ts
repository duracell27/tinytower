import {
  Injectable, BadRequestException, ForbiddenException,
  HttpException, HttpStatus, NotFoundException,
} from '@nestjs/common';
import { ForumCategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const POST_SELECT = {
  id: true, playerId: true, playerName: true, playerLevel: true,
  category: true, title: true, body: true,
  isPinned: true, isClosed: true, commentCount: true,
  createdAt: true, updatedAt: true,
};

const COMMENT_SELECT = {
  id: true, postId: true, playerId: true, playerName: true,
  playerLevel: true, body: true, createdAt: true, updatedAt: true,
};

@Injectable()
export class ForumService {
  constructor(private prisma: PrismaService) {}

  async getUnreadCounts(playerId: string): Promise<Record<ForumCategory, number>> {
    const posts = await this.prisma.forumPost.findMany({
      where: { deletedAt: null },
      select: { id: true, category: true, commentCount: true },
    });
    const reads = await this.prisma.forumPostRead.findMany({
      where: { playerId, postId: { in: posts.map(p => p.id) } },
      select: { postId: true, lastSeenCommentCount: true },
    });
    const readMap = new Map(reads.map(r => [r.postId, r.lastSeenCommentCount]));
    const counts = { NEWS: 0, HELP: 0, GENERAL: 0, CITIES: 0, PURCHASES: 0 } as Record<ForumCategory, number>;
    for (const post of posts) {
      if ((readMap.get(post.id) ?? -1) < post.commentCount) {
        counts[post.category]++;
      }
    }
    return counts;
  }

  async getPosts(category: ForumCategory, page: number, limit: number, playerId: string) {
    const skip = (page - 1) * limit;
    const [total, posts] = await Promise.all([
      this.prisma.forumPost.count({ where: { category, deletedAt: null } }),
      this.prisma.forumPost.findMany({
        where: { category, deletedAt: null },
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
        select: POST_SELECT,
      }),
    ]);
    const reads = await this.prisma.forumPostRead.findMany({
      where: { playerId, postId: { in: posts.map(p => p.id) } },
      select: { postId: true, lastSeenCommentCount: true },
    });
    const readMap = new Map(reads.map(r => [r.postId, r.lastSeenCommentCount]));
    return {
      posts: posts.map(p => ({ ...p, isUnread: (readMap.get(p.id) ?? -1) < p.commentCount })),
      total,
      page,
      hasMore: skip + posts.length < total,
    };
  }

  async createPost(playerId: string, category: ForumCategory, title: string, body: string, isAdmin: boolean) {
    if (category === 'NEWS' && !isAdmin) throw new ForbiddenException('Only admins can post in News');
    if (title.length > 200) throw new BadRequestException('Title exceeds 200 characters');
    if (body.length > 5000) throw new BadRequestException('Body exceeds 5000 characters');

    const player = await this.prisma.player.findUnique({ where: { id: playerId }, select: { playerName: true, playerLevel: true } });
    if (!player) throw new NotFoundException('Player not found');

    const cooldownCutoff = new Date(Date.now() - 60 * 1000);
    const recent = await this.prisma.forumPost.findFirst({ where: { playerId, createdAt: { gte: cooldownCutoff }, deletedAt: null } });
    if (recent) throw new HttpException('Post cooldown: please wait before posting again', HttpStatus.TOO_MANY_REQUESTS);

    const post = await this.prisma.forumPost.create({
      data: { playerId, playerName: player.playerName, playerLevel: player.playerLevel, category, title, body },
      select: POST_SELECT,
    });
    return { ...post, isUnread: false };
  }

  async getPost(id: string, playerId: string) {
    const post = await this.prisma.forumPost.findFirst({ where: { id, deletedAt: null }, select: POST_SELECT });
    if (!post) throw new NotFoundException('Post not found');
    const read = await this.prisma.forumPostRead.findUnique({ where: { playerId_postId: { playerId, postId: id } } });
    return { ...post, isUnread: (read?.lastSeenCommentCount ?? -1) < post.commentCount };
  }

  async updatePost(id: string, title: string, body: string, requesterId: string, isAdmin: boolean) {
    const post = await this.prisma.forumPost.findFirst({ where: { id, deletedAt: null }, select: { playerId: true } });
    if (!post) throw new NotFoundException('Post not found');
    if (!isAdmin && post.playerId !== requesterId) throw new ForbiddenException('You can only edit your own posts');
    if (title.length > 200) throw new BadRequestException('Title exceeds 200 characters');
    if (body.length > 5000) throw new BadRequestException('Body exceeds 5000 characters');
    const updated = await this.prisma.forumPost.update({ where: { id }, data: { title, body }, select: POST_SELECT });
    const read = await this.prisma.forumPostRead.findUnique({ where: { playerId_postId: { playerId: requesterId, postId: id } } });
    return { ...updated, isUnread: (read?.lastSeenCommentCount ?? -1) < updated.commentCount };
  }

  async deletePost(id: string, requesterId: string, isAdmin: boolean): Promise<{ success: true }> {
    const post = await this.prisma.forumPost.findFirst({ where: { id, deletedAt: null }, select: { playerId: true } });
    if (!post) throw new NotFoundException('Post not found');
    if (!isAdmin && post.playerId !== requesterId) throw new ForbiddenException('You can only delete your own posts');
    await this.prisma.forumPost.update({ where: { id }, data: { deletedAt: new Date() } });
    return { success: true };
  }

  async pinPost(id: string, isPinned: boolean, callerPlayerId: string) {
    const post = await this.prisma.forumPost.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!post) throw new NotFoundException('Post not found');
    const updated = await this.prisma.forumPost.update({ where: { id }, data: { isPinned }, select: POST_SELECT });
    const read = await this.prisma.forumPostRead.findUnique({ where: { playerId_postId: { playerId: callerPlayerId, postId: id } } });
    return { ...updated, isUnread: (read?.lastSeenCommentCount ?? -1) < updated.commentCount };
  }

  async closePost(id: string, isClosed: boolean, callerPlayerId: string) {
    const post = await this.prisma.forumPost.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!post) throw new NotFoundException('Post not found');
    const updated = await this.prisma.forumPost.update({ where: { id }, data: { isClosed }, select: POST_SELECT });
    const read = await this.prisma.forumPostRead.findUnique({ where: { playerId_postId: { playerId: callerPlayerId, postId: id } } });
    return { ...updated, isUnread: (read?.lastSeenCommentCount ?? -1) < updated.commentCount };
  }

  async markRead(playerId: string, postId: string): Promise<{ success: true }> {
    const post = await this.prisma.forumPost.findFirst({ where: { id: postId, deletedAt: null }, select: { commentCount: true } });
    if (!post) throw new NotFoundException('Post not found');
    await this.prisma.forumPostRead.upsert({
      where: { playerId_postId: { playerId, postId } },
      create: { playerId, postId, lastSeenCommentCount: post.commentCount },
      update: { lastSeenCommentCount: post.commentCount },
    });
    return { success: true };
  }

  async getComments(postId: string, page: number, limit: number) {
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
        select: COMMENT_SELECT,
      }),
    ]);
    return { comments, total, page, hasMore: skip + comments.length < total };
  }

  async createComment(playerId: string, postId: string, body: string) {
    if (body.length > 1000) throw new BadRequestException('Comment exceeds 1000 characters');
    const post = await this.prisma.forumPost.findFirst({ where: { id: postId, deletedAt: null }, select: { isClosed: true } });
    if (!post) throw new NotFoundException('Post not found');
    if (post.isClosed) throw new ForbiddenException('Topic is closed');

    const player = await this.prisma.player.findUnique({ where: { id: playerId }, select: { playerName: true, playerLevel: true } });
    if (!player) throw new NotFoundException('Player not found');

    const cooldownCutoff = new Date(Date.now() - 10 * 1000);
    const recent = await this.prisma.forumComment.findFirst({ where: { playerId, createdAt: { gte: cooldownCutoff }, deletedAt: null } });
    if (recent) throw new HttpException('Comment cooldown: please wait before commenting again', HttpStatus.TOO_MANY_REQUESTS);

    const [comment] = await this.prisma.$transaction([
      this.prisma.forumComment.create({ data: { postId, playerId, playerName: player.playerName, playerLevel: player.playerLevel, body }, select: COMMENT_SELECT }),
      this.prisma.forumPost.update({ where: { id: postId }, data: { commentCount: { increment: 1 } } }),
    ]);
    return comment;
  }

  async updateComment(id: string, body: string, requesterId: string, isAdmin: boolean) {
    if (body.length > 1000) throw new BadRequestException('Comment exceeds 1000 characters');
    const comment = await this.prisma.forumComment.findFirst({ where: { id, deletedAt: null }, select: { playerId: true } });
    if (!comment) throw new NotFoundException('Comment not found');
    if (!isAdmin && comment.playerId !== requesterId) throw new ForbiddenException('You can only edit your own comments');
    return this.prisma.forumComment.update({ where: { id }, data: { body }, select: COMMENT_SELECT });
  }

  async deleteComment(id: string, requesterId: string, isAdmin: boolean): Promise<{ success: true }> {
    const comment = await this.prisma.forumComment.findFirst({ where: { id, deletedAt: null }, select: { playerId: true, postId: true } });
    if (!comment) throw new NotFoundException('Comment not found');
    if (!isAdmin && comment.playerId !== requesterId) throw new ForbiddenException('You can only delete your own comments');
    await this.prisma.$transaction([
      this.prisma.forumComment.update({ where: { id }, data: { deletedAt: new Date() } }),
      this.prisma.forumPost.update({ where: { id: comment.postId }, data: { commentCount: { decrement: 1 } } }),
    ]);
    return { success: true };
  }
}
