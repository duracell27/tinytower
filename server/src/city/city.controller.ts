import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { CityRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CityService } from './city.service';

type AuthReq = { user: { playerId: string } };

@Controller('city')
export class CityController {
  constructor(private cityService: CityService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  createCity(@Req() req: AuthReq, @Body() body: { name: string }) {
    return this.cityService.createCity(req.user.playerId, body.name);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  getMyCityInfo(@Req() req: AuthReq) {
    return this.cityService.getMyCityInfo(req.user.playerId);
  }

  @Get('search')
  @UseGuards(JwtAuthGuard)
  searchCities(@Query('q') q: string) {
    return this.cityService.searchCities(q ?? '');
  }

  @Get('rankings')
  @UseGuards(JwtAuthGuard)
  getCityRankings(@Query('page') page: string) {
    const p = Math.max(1, parseInt(page ?? '1', 10) || 1);
    return this.cityService.getCityRankings(p);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  getCityById(@Req() req: AuthReq, @Param('id') id: string) {
    return this.cityService.getCityById(id, req.user.playerId);
  }

  @Post(':id/invite/:playerId')
  @UseGuards(JwtAuthGuard)
  invitePlayer(
    @Req() req: AuthReq,
    @Param('id') cityId: string,
    @Param('playerId') targetPlayerId: string,
  ) {
    return this.cityService.invitePlayer(req.user.playerId, cityId, targetPlayerId);
  }

  @Post('invite/:token/accept')
  @UseGuards(JwtAuthGuard)
  acceptInvite(@Req() req: AuthReq, @Param('token') token: string) {
    return this.cityService.respondToInvite(req.user.playerId, token, true);
  }

  @Post('invite/:token/decline')
  @UseGuards(JwtAuthGuard)
  declineInvite(@Req() req: AuthReq, @Param('token') token: string) {
    return this.cityService.respondToInvite(req.user.playerId, token, false);
  }

  @Delete('leave')
  @UseGuards(JwtAuthGuard)
  leaveCity(@Req() req: AuthReq) {
    return this.cityService.leaveCity(req.user.playerId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  deleteCity(@Req() req: AuthReq, @Param('id') cityId: string) {
    return this.cityService.deleteCity(req.user.playerId, cityId);
  }

  @Delete(':id/kick/:playerId')
  @UseGuards(JwtAuthGuard)
  kickMember(
    @Req() req: AuthReq,
    @Param('id') cityId: string,
    @Param('playerId') targetPlayerId: string,
  ) {
    return this.cityService.kickMember(req.user.playerId, cityId, targetPlayerId);
  }

  @Patch(':id/member/:playerId/role')
  @UseGuards(JwtAuthGuard)
  changeMemberRole(
    @Req() req: AuthReq,
    @Param('id') cityId: string,
    @Param('playerId') targetPlayerId: string,
    @Body() body: { role: CityRole },
  ) {
    return this.cityService.changeMemberRole(req.user.playerId, cityId, targetPlayerId, body.role);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  updateCity(
    @Req() req: AuthReq,
    @Param('id') cityId: string,
    @Body() body: { name?: string; description?: string },
  ) {
    return this.cityService.updateCity(req.user.playerId, cityId, body);
  }

  @Get(':id/xp-stats')
  @UseGuards(JwtAuthGuard)
  getXpStats(@Req() req: AuthReq, @Param('id') cityId: string) {
    return this.cityService.getXpStats(cityId, req.user.playerId);
  }

  @Post(':id/reset-xp-period')
  @UseGuards(JwtAuthGuard)
  resetXpPeriod(@Req() req: AuthReq, @Param('id') cityId: string) {
    return this.cityService.resetXpPeriod(cityId, req.user.playerId);
  }
}
