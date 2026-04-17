import { Injectable } from '@nestjs/common';
import {
  EmailProvider,
  SendEmailDto,
  EmailResult,
} from '../interfaces/email-provider.interface';

@Injectable()
export class BrevoProvider implements EmailProvider {
  readonly providerName = 'brevo';

  async send(_payload: SendEmailDto): Promise<EmailResult> {
    throw new Error('BrevoProvider: implementacion pendiente');
  }
}
