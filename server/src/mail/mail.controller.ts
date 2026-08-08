import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MailService } from './mail.service';

type AuthReq = { user: { playerId: string } };

class SendMailDto {
  subject!: string;
  body!: string;
}

@Controller('mail')
export class MailController {
  constructor(private mailService: MailService) {}

  @Post('send/:toId')
  @UseGuards(JwtAuthGuard)
  sendMail(@Req() req: AuthReq, @Param('toId') toId: string, @Body() dto: SendMailDto) {
    return this.mailService.sendMail(req.user.playerId, toId, dto.subject, dto.body);
  }

  @Get('inbox')
  @UseGuards(JwtAuthGuard)
  getInbox(@Req() req: AuthReq) {
    return this.mailService.getInbox(req.user.playerId);
  }

  @Get('unread-count')
  @UseGuards(JwtAuthGuard)
  getUnreadCount(@Req() req: AuthReq) {
    return this.mailService.getUnreadCount(req.user.playerId);
  }

  @Post(':id/read')
  @UseGuards(JwtAuthGuard)
  markRead(@Req() req: AuthReq, @Param('id') id: string) {
    return this.mailService.markRead(id, req.user.playerId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  deleteMail(@Req() req: AuthReq, @Param('id') id: string) {
    return this.mailService.deleteMail(id, req.user.playerId);
  }
}
