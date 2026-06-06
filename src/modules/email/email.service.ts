import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  EmailProvider,
  EmailResult,
  SendEmailDto,
} from './interfaces/email-provider.interface';
import { EMAIL_PROVIDER_TOKEN } from './constants/email-tokens';
import { buildOtpTemplate } from './templates/otp-verification.template';
import { buildPasswordResetTemplate } from './templates/password-reset.template';
import { buildLoginOtpTemplate } from './templates/login-otp.template';
import { buildWelcomeTemplate } from './templates/welcome.template';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @Inject(EMAIL_PROVIDER_TOKEN) private readonly provider: EmailProvider,
    private readonly prisma: PrismaService,
  ) {
    this.logger.log(`Proveedor de email activo: ${this.provider.providerName}`);
  }

  private async send(payload: SendEmailDto): Promise<EmailResult> {
    const override = await this.getTestingModeAddress();
    if (override) {
      const original = Array.isArray(payload.to)
        ? payload.to.join(', ')
        : payload.to;
      this.logger.warn(
        `[TestingMode] Redirigiendo email de "${original}" a "${override}"`,
      );
      payload = { ...payload, to: override };
    }
    return this.provider.send(payload);
  }

  private async getTestingModeAddress(): Promise<string | null> {
    const enabled = await this.prisma.appSetting.findUnique({
      where: { key: 'email.testingMode' },
    });
    if (enabled?.value !== 'true') return null;

    const address = await this.prisma.appSetting.findUnique({
      where: { key: 'email.testingMode.address' },
    });
    return address?.value || null;
  }

  async sendOtpVerification(params: {
    to: string;
    username: string;
    code: string;
    expiresInMinutes: number;
  }): Promise<EmailResult> {
    const { html, text } = buildOtpTemplate(params);
    return this.send({
      to: params.to,
      subject: 'Verifica tu cuenta en PlotCraft',
      html,
      text,
      tags: { type: 'otp', flow: 'register' },
    });
  }

  async sendPasswordResetOtp(params: {
    to: string;
    username: string;
    code: string;
    expiresInMinutes: number;
  }): Promise<EmailResult> {
    const { html, text } = buildPasswordResetTemplate(params);
    return this.send({
      to: params.to,
      subject: 'Restablece tu contraseña en PlotCraft',
      html,
      text,
      tags: { type: 'otp', flow: 'password-reset' },
    });
  }

  async sendLoginOtp(params: {
    to: string;
    username: string;
    code: string;
    expiresInMinutes: number;
  }): Promise<EmailResult> {
    const { html, text } = buildLoginOtpTemplate(params);
    return this.send({
      to: params.to,
      subject: 'Tu codigo de inicio de sesion en PlotCraft',
      html,
      text,
      tags: { type: 'otp', flow: 'admin-login' },
    });
  }

  async sendWelcome(params: {
    to: string;
    username: string;
    nickname: string;
  }): Promise<EmailResult> {
    const { html, text } = buildWelcomeTemplate(params);
    return this.send({
      to: params.to,
      subject: `Bienvenido a PlotCraft, ${params.nickname}`,
      html,
      text,
      tags: { type: 'welcome' },
    });
  }
}
