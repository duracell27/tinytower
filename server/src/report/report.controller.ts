import { Controller, Post, Body, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReportService } from './report.service';
import { ReportTargetType, ReportCategory } from '@prisma/client';

const REPORT_TYPES = ['CHAT_MESSAGE', 'FORUM_POST', 'FORUM_COMMENT'] as const;
const REPORT_CATEGORIES = ['SPAM', 'INSULT', 'ADVERTISEMENT', 'PROFANITY', 'THREAT', 'OTHER'] as const;

const CreateReportSchema = z.object({
  targetType: z.enum(REPORT_TYPES),
  targetId: z.string().min(1),
  category: z.enum(REPORT_CATEGORIES),
});

type AuthReq = { user: { playerId: string } };

@Controller('report')
export class ReportController {
  constructor(private reportService: ReportService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createReport(@Req() req: AuthReq, @Body() body: unknown) {
    const parsed = CreateReportSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return this.reportService.createReport(
      req.user.playerId,
      parsed.data.targetType as ReportTargetType,
      parsed.data.targetId,
      parsed.data.category as ReportCategory,
    );
  }
}
