import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { EmailProvider, SendEmailDto, EmailResult } from '../interfaces/email-provider.interface';

@Injectable()
export class ResendProvider implements EmailProvider {
  readonly providerName = 'resend';
  private readonly client: Resend;
  private readonly from: string;
  private readonly logger = new Logger(ResendProvider.name);

  constructor(private readonly config: ConfigService) {
    this.client = new Resend(this.config.getOrThrow<string>('RESEND_API_KEY'));
    this.from = this.config.getOrThrow<string>('EMAIL_FROM');
  }

  async send(payload: SendEmailDto): Promise<EmailResult> {
    try {
      const { data, error } = await this.client.emails.send({
        from: this.from,
        to: Array.isArray(payload.to) ? payload.to : [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        replyTo: payload.replyTo,
        tags: payload.tags
          ? Object.entries(payload.tags).map(([name, value]) => ({ name, value }))
          : undefined,
      });

      if (error) {
        this.logger.error(`Resend send error: ${error.message}`);
        return { success: false, provider: this.providerName, error: error.message };
      }

      this.logger.log(`Email sent via Resend. messageId=${data?.id}`);
      return { success: true, provider: this.providerName, messageId: data?.id };
    } catch (err: any) {
      this.logger.error('Unexpected error in ResendProvider', err?.message);
      return { success: false, provider: this.providerName, error: err?.message };
    }
  }
}
