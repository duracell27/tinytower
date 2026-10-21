import { Controller, Post, Body, Req, HttpCode, BadRequestException, HttpStatus } from '@nestjs/common';
import { Request } from 'express';
import { EmailService } from '../email/email.service';

const RATE_LIMIT_MS = 60_000;
const ipLastSent = new Map<string, number>();

@Controller('contact')
export class ContactController {
  constructor(private readonly email: EmailService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async submit(@Body() body: Record<string, string>, @Req() req: Request) {
    const name    = (body.name    ?? '').trim().slice(0, 120);
    const from    = (body.email   ?? '').trim().slice(0, 254);
    const subject = (body.subject ?? '').trim().slice(0, 120);
    const message = (body.message ?? '').trim().slice(0, 3000);

    if (!from || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from)) {
      throw new BadRequestException('Invalid email');
    }
    if (!message) throw new BadRequestException('Message is required');

    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? '';
    const now = Date.now();
    const last = ipLastSent.get(ip) ?? 0;
    if (now - last < RATE_LIMIT_MS) {
      throw new BadRequestException('Too many requests — please wait a moment');
    }
    ipLastSent.set(ip, now);

    await this.email.sendContactEmail({ name: name || 'Anonymous', email: from, subject, message });
    return { ok: true };
  }
}
