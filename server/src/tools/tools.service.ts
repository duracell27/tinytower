import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ToolsService {
  constructor(private prisma: PrismaService) {}

  async getTools(playerId: string): Promise<{ briks: number; glass: number; nails: number; screw: number }> {
    const tools = await this.prisma.playerState.findUnique({ where: { playerId } });
    if (!tools) return { briks: 1, glass: 1, nails: 1, screw: 1 };
    return { briks: tools.briks, glass: tools.glass, nails: tools.nails, screw: tools.screw };
  }
}
