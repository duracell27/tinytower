import { Controller, Post, Delete, Body, UseGuards, Req, HttpCode, BadRequestException, ConflictException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RegisterSchema } from './dto/register.dto';
import { LoginSchema } from './dto/login.dto';
import { RefreshSchema } from './dto/refresh.dto';
import { ConvertSchema } from './dto/convert.dto';
import { SocialLoginSchema } from './dto/social-login.dto';
import { ConvertSocialSchema } from './dto/convert-social.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() body: unknown) {
    const result = RegisterSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.issues.map((i) => i.message).join(", "));
    return this.authService.register(result.data);
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: unknown) {
    const result = LoginSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.issues.map((i) => i.message).join(", "));
    return this.authService.login(result.data);
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() body: unknown) {
    const result = RefreshSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.issues.map((i) => i.message).join(", "));
    return this.authService.refresh(result.data.refreshToken);
  }

  @Post('guest')
  @HttpCode(200)
  async registerAsGuest() {
    return this.authService.registerAsGuest();
  }

  @Post('convert')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async convertAccount(@Req() req: { user: { playerId: string } }, @Body() body: unknown) {
    const result = ConvertSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.issues.map((i) => i.message).join(", "));
    return this.authService.convertAccount(req.user.playerId, result.data);
  }

  @Post('social/google')
  @HttpCode(200)
  async socialGoogle(@Body() body: unknown) {
    const result = SocialLoginSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.issues.map((i) => i.message).join(', '));
    return this.authService.loginWithGoogle(result.data.idToken);
  }

  @Post('social/apple')
  @HttpCode(200)
  async socialApple(@Body() body: unknown) {
    const result = SocialLoginSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.issues.map((i) => i.message).join(', '));
    return this.authService.loginWithApple(result.data.idToken, result.data.fullName);
  }

  @Post('convert/google')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async convertGoogle(@Req() req: { user: { playerId: string } }, @Body() body: unknown) {
    const result = ConvertSocialSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.issues.map((i) => i.message).join(', '));
    try {
      return await this.authService.convertWithGoogle(req.user.playerId, result.data.idToken, result.data.overwrite ?? false);
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'status' in e && (e as { status: number }).status === 409) {
        throw new ConflictException({ existingPlayerName: (e as unknown as { existingPlayerName: string }).existingPlayerName });
      }
      throw e;
    }
  }

  @Post('convert/apple')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async convertApple(@Req() req: { user: { playerId: string } }, @Body() body: unknown) {
    const result = ConvertSocialSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.issues.map((i) => i.message).join(', '));
    try {
      return await this.authService.convertWithApple(req.user.playerId, result.data.idToken, result.data.fullName, result.data.overwrite ?? false);
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'status' in e && (e as { status: number }).status === 409) {
        throw new ConflictException({ existingPlayerName: (e as unknown as { existingPlayerName: string }).existingPlayerName });
      }
      throw e;
    }
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: { user: { playerId: string } }) {
    await this.authService.logout(req.user.playerId);
    return {};
  }

  @Delete('account')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async deleteAccount(@Req() req: { user: { playerId: string } }) {
    await this.authService.deleteAccount(req.user.playerId);
    return {};
  }
}
