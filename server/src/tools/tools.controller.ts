import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ToolsService } from './tools.service';

@Controller('tools')
export class ToolsController {
  constructor(private toolsService: ToolsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getTools(@Req() req: { user: { playerId: string } }) {
    return this.toolsService.getTools(req.user.playerId);
  }
}
