import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly resend: Resend;
  private readonly from: string;
  private readonly logger = new Logger(EmailService.name);

  constructor(private config: ConfigService) {
    this.resend = new Resend(this.config.get<string>('RESEND_API_KEY'));
    this.from = this.config.get<string>('EMAIL_FROM') ?? 'noreply@vibetower.app';
  }

  async sendWelcomeEmail(email: string, playerName: string): Promise<void> {
    try {
      await this.resend.emails.send({
        from: this.from,
        to: email,
        subject: '🏙️ Welcome to Vibe Tower!',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="color:#3FA535">Hey ${playerName}, welcome to Vibe Tower! 👋</h2>
            <p>Your account is ready. Time to build, grow, and vibe your way to the top!</p>
            <p style="color:#888;font-size:13px">If you didn't register for Vibe Tower, you can safely ignore this email.</p>
          </div>
        `,
      });
    } catch (err) {
      this.logger.error('Failed to send welcome email', err);
    }
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const deepLink = `vibetower://reset-password?token=${token}`;
    try {
      await this.resend.emails.send({
        from: this.from,
        to: email,
        subject: '🔑 Reset your Vibe Tower password',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="color:#3FA535">Reset your password</h2>
            <p>Tap the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
            <a href="${deepLink}" style="display:inline-block;background:#3FA535;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
              Reset Password
            </a>
            <p style="color:#888;font-size:13px">If you didn't request a password reset, you can safely ignore this email.</p>
          </div>
        `,
      });
    } catch (err) {
      this.logger.error('Failed to send password reset email', err);
    }
  }
}
