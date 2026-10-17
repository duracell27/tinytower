import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ user?: { playerId?: string; isAdmin?: boolean } }>();
    if (!req.user?.isAdmin) throw new ForbiddenException('Admin access required');
    const player = await this.prisma.player.findUnique({
      where: { id: req.user.playerId },
      select: { isAdmin: true },
    });
    if (!player?.isAdmin) throw new ForbiddenException('Admin access required');
    return true;
  }
}
