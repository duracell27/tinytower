import { Controller, Get, Post, Delete, Param, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FriendsService } from './friends.service';

type AuthReq = { user: { playerId: string } };

@Controller('friends')
export class FriendsController {
  constructor(private friendsService: FriendsService) {}

  @Get('status/:playerId')
  @UseGuards(JwtAuthGuard)
  getStatus(@Req() req: AuthReq, @Param('playerId') playerId: string) {
    return this.friendsService.getStatus(req.user.playerId, playerId);
  }

  @Get('requests/incoming')
  @UseGuards(JwtAuthGuard)
  getIncoming(@Req() req: AuthReq) {
    return this.friendsService.getIncomingRequests(req.user.playerId);
  }

  @Get('requests/outgoing')
  @UseGuards(JwtAuthGuard)
  getOutgoing(@Req() req: AuthReq) {
    return this.friendsService.getOutgoingRequests(req.user.playerId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  getFriends(@Req() req: AuthReq) {
    return this.friendsService.getFriends(req.user.playerId);
  }

  @Post('request/:toId')
  @UseGuards(JwtAuthGuard)
  sendRequest(@Req() req: AuthReq, @Param('toId') toId: string) {
    return this.friendsService.sendRequest(req.user.playerId, toId);
  }

  @Delete('request/:requestId')
  @UseGuards(JwtAuthGuard)
  cancelRequest(@Req() req: AuthReq, @Param('requestId') requestId: string): Promise<{ success: true }> {
    return this.friendsService.cancelRequest(requestId, req.user.playerId);
  }

  @Post('request/:requestId/accept')
  @UseGuards(JwtAuthGuard)
  acceptRequest(@Req() req: AuthReq, @Param('requestId') requestId: string): Promise<{ success: true }> {
    return this.friendsService.acceptRequest(requestId, req.user.playerId);
  }

  @Post('request/:requestId/reject')
  @UseGuards(JwtAuthGuard)
  rejectRequest(@Req() req: AuthReq, @Param('requestId') requestId: string): Promise<{ success: true }> {
    return this.friendsService.rejectRequest(requestId, req.user.playerId);
  }

  @Delete(':requestId')
  @UseGuards(JwtAuthGuard)
  removeFriend(@Req() req: AuthReq, @Param('requestId') requestId: string): Promise<{ success: true }> {
    return this.friendsService.removeFriend(requestId, req.user.playerId);
  }
}
