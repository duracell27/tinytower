import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import * as path from 'path';

@Controller()
export class WebController {
  // SPA catch-all: serves admin/index.html for any /admin/* that doesn't match an API route.
  // NestJS registers specific routes first, so /admin/players etc. still hit AdminController.
  @Get('admin/*')
  serveAdmin(@Res() res: Response) {
    res.sendFile(path.join(process.cwd(), 'public', 'admin', 'index.html'));
  }
}
