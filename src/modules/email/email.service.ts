import { Inject, Injectable, Logger } from '@nestjs/common';
import { EmailProvider, EmailResult } from './interfaces/email-provider.interface';
import { EMAIL_PROVIDER_TOKEN } from './constants/email-tokens';
import { buildOtpTemplate } from './templates/otp-verification.template';
import { buildWelcomeTemplate } from './templates/welcome.template';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @Inject(EMAIL_PROVIDER_TOKEN) private readonly provider: EmailProvider,
  ) {
    this.logger.log(`Proveedor de email activo: ${this.provider.providerName}`);
  }

  async sendOtpVerification(params: {
    to: string;
    username: string;
    code: string;
    expiresInMinutes: number;
  }): Promise<EmailResult> {
    const { html, text } = buildOtpTemplate(params);
    return this.provider.send({
      to: params.to,
      subject: 'Verifica tu cuenta en PlotCraft',
      html,
      text,
      tags: { type: 'otp', flow: 'register' },
    });
  }

  async sendWelcome(params: {
    to: string;
    username: string;
    nickname: string;
  }): Promise<EmailResult> {
    const { html, text } = buildWelcomeTemplate(params);
    return this.provider.send({
      to: params.to,
      subject: `Bienvenido a PlotCraft, ${params.nickname}`,
      html,
      text,
      tags: { type: 'welcome' },
    });
  }
}
