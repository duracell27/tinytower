import { Controller, Post, Body, UseGuards, Req, HttpCode, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RegisterSchema } from './dto/register.dto';
import { LoginSchema } from './dto/login.dto';
import { RefreshSchema } from './dto/refresh.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() body: unknown) {
    const result = RegisterSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.issues);
    return this.authService.register(result.data);
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: unknown) {
    const result = LoginSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.issues);
    return this.authService.login(result.data);
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() body: unknown) {
    const result = RefreshSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.issues);
    return this.authService.refresh(result.data.refreshToken);
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: { user: { playerId: string } }) {
    await this.authService.logout(req.user.playerId);
    return {};
  }
}
