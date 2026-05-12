import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface SmsResult {
  success: boolean;
  error?: string;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly fromNumber: string | undefined;
  private readonly whatsappFrom: string | undefined;
  private client: any = null;

  constructor(private readonly config: ConfigService) {
    const accountSid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.config.get<string>('TWILIO_AUTH_TOKEN');
    const apiKeySid = this.config.get<string>('TWILIO_API_KEY_SID');
    const apiKeySecret = this.config.get<string>('TWILIO_API_KEY_SECRET');
    this.fromNumber = this.config.get<string>('TWILIO_PHONE_NUMBER');
    this.whatsappFrom = this.config.get<string>('TWILIO_WHATSAPP_NUMBER') || this.fromNumber;

    const hasApiKey = apiKeySid && apiKeySecret && accountSid;
    const hasAccountAuth = accountSid && authToken;

    if (hasApiKey || hasAccountAuth) {
      import('twilio').then((mod) => {
        if (hasApiKey) {
          // API Key authentication (preferred)
          this.client = mod.default(apiKeySid, apiKeySecret, { accountSid });
          this.logger.log('Twilio client initialized (API Key auth)');
        } else {
          // Account SID + Auth Token
          this.client = mod.default(accountSid, authToken);
          this.logger.log('Twilio client initialized (Account auth)');
        }
      }).catch(() => {
        this.logger.warn('Twilio SDK not available — SMS disabled');
      });
    } else {
      this.logger.warn('Twilio credentials not configured — SMS will be logged to console');
    }
  }

  async sendSms(to: string, body: string): Promise<SmsResult> {
    if (!this.client || !this.fromNumber) {
      this.logger.log(`[SMS CONSOLE] To: ${to} | Body: ${body}`);
      return { success: true };
    }

    try {
      await this.client.messages.create({
        to,
        from: this.fromNumber,
        body,
      });
      return { success: true };
    } catch (err: any) {
      this.logger.error(`SMS send failed to ${to}: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  async sendWhatsApp(to: string, body: string): Promise<SmsResult> {
    if (!this.client || !this.whatsappFrom) {
      this.logger.log(`[WHATSAPP CONSOLE] To: ${to} | Body: ${body}`);
      return { success: true };
    }

    try {
      await this.client.messages.create({
        to: `whatsapp:${to}`,
        from: `whatsapp:${this.whatsappFrom}`,
        body,
      });
      return { success: true };
    } catch (err: any) {
      this.logger.error(`WhatsApp send failed to ${to}: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  async sendOtp(to: string, code: string, channel: 'sms' | 'whatsapp' = 'sms'): Promise<SmsResult> {
    const body = `PlotCraft Admin: Tu codigo de verificacion es ${code}. Expira en 5 minutos.`;
    return channel === 'whatsapp'
      ? this.sendWhatsApp(to, body)
      : this.sendSms(to, body);
  }

  isConfigured(): boolean {
    return !!this.client && !!this.fromNumber;
  }
}
