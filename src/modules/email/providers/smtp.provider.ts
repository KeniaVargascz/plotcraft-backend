import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import {
  EmailProvider,
  SendEmailDto,
  EmailResult,
} from '../interfaces/email-provider.interface';

@Injectable()
export class SmtpProvider implements EmailProvider {
  readonly providerName = 'smtp';
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;
  private readonly logger = new Logger(SmtpProvider.name);

  constructor(private readonly config: ConfigService) {
    this.from = this.config.getOrThrow<string>('EMAIL_FROM');
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST', 'smtp.gmail.com'),
      port: this.config.get<number>('SMTP_PORT', 587),
      secure: false,
      auth: {
        user: this.config.getOrThrow<string>('SMTP_USER'),
        pass: this.config.getOrThrow<string>('SMTP_PASS'),
      },
    });
  }

  async send(payload: SendEmailDto): Promise<EmailResult> {
    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to: Array.isArray(payload.to) ? payload.to.join(', ') : payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        replyTo: payload.replyTo,
      });

      this.logger.log(`Email sent via SMTP. messageId=${info.messageId}`);
      return {
        success: true,
        provider: this.providerName,
        messageId: info.messageId,
      };
    } catch (err: any) {
      this.logger.error(`SMTP send error: ${err?.message}`);
      return {
        success: false,
        provider: this.providerName,
        error: err?.message,
      };
    }
  }
}
