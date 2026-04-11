import { Injectable, Logger } from '@nestjs/common';
import { EmailProvider, SendEmailDto, EmailResult } from '../interfaces/email-provider.interface';

@Injectable()
export class ConsoleProvider implements EmailProvider {
  readonly providerName = 'console';
  private readonly logger = new Logger('EmailConsole');

  async send(payload: SendEmailDto): Promise<EmailResult> {
    const id = `console-${Date.now()}`;
    this.logger.debug('╔══════════════ EMAIL (dev) ══════════════╗');
    this.logger.debug(`  To:      ${payload.to}`);
    this.logger.debug(`  Subject: ${payload.subject}`);
    this.logger.debug(`  Text:    ${payload.text ?? '[solo HTML]'}`);
    this.logger.debug(`  Tags:    ${JSON.stringify(payload.tags ?? {})}`);
    this.logger.debug('╚═════════════════════════════════════════╝');
    return { success: true, provider: this.providerName, messageId: id };
  }
}
