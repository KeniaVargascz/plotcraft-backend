import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { ResendProvider } from './providers/resend.provider';
import { BrevoProvider } from './providers/brevo.provider';
import { ConsoleProvider } from './providers/console.provider';
import { SmtpProvider } from './providers/smtp.provider';
import { EMAIL_PROVIDER_TOKEN } from './constants/email-tokens';

const PROVIDER_MAP = {
  resend: ResendProvider,
  brevo: BrevoProvider,
  console: ConsoleProvider,
  smtp: SmtpProvider,
} as const;

type ProviderKey = keyof typeof PROVIDER_MAP;

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: EMAIL_PROVIDER_TOKEN,
      useFactory: (config: ConfigService) => {
        const key = config.get<string>(
          'EMAIL_PROVIDER',
          'resend',
        ) as ProviderKey;
        const Provider = PROVIDER_MAP[key];
        if (!Provider) {
          throw new Error(
            `EMAIL_PROVIDER desconocido: "${key}". Opciones: ${Object.keys(PROVIDER_MAP).join(', ')}`,
          );
        }
        return new Provider(config);
      },
      inject: [ConfigService],
    },
    EmailService,
  ],
  exports: [EmailService],
})
export class EmailModule {}
