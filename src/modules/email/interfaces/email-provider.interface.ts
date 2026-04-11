export interface SendEmailDto {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  tags?: Record<string, string>;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  provider: string;
  error?: string;
}

export interface EmailProvider {
  readonly providerName: string;
  send(payload: SendEmailDto): Promise<EmailResult>;
}
