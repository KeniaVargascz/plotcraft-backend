import { ConfigService } from '@nestjs/config';
import { ResendProvider } from '../../modules/email/providers/resend.provider';

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn(),
    },
  })),
}));

describe('ResendProvider', () => {
  const configService = {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'RESEND_API_KEY') return 're_test_key';
      if (key === 'EMAIL_FROM') return 'PlotCraft <noreply@plotcraft.com>';
      return key;
    }),
  } as unknown as ConfigService;

  let provider: ResendProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new ResendProvider(configService);
  });

  it('should call resend.emails.send with the mapped payload', async () => {
    const resendClient = (provider as any).client;
    resendClient.emails.send.mockResolvedValue({
      data: { id: 'msg-123' },
      error: null,
    });

    const result = await provider.send({
      to: 'user@test.com',
      subject: 'Test',
      html: '<p>Hello</p>',
      text: 'Hello',
      tags: { type: 'test' },
    });

    expect(resendClient.emails.send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'PlotCraft <noreply@plotcraft.com>',
        to: ['user@test.com'],
        subject: 'Test',
        html: '<p>Hello</p>',
        text: 'Hello',
      }),
    );
    expect(result).toEqual({
      success: true,
      provider: 'resend',
      messageId: 'msg-123',
    });
  });

  it('should return success: false when Resend returns an error', async () => {
    const resendClient = (provider as any).client;
    resendClient.emails.send.mockResolvedValue({
      data: null,
      error: { message: 'Invalid API key' },
    });

    const result = await provider.send({
      to: 'user@test.com',
      subject: 'Test',
      html: '<p>Hello</p>',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid API key');
  });

  it('should return success: true with messageId on successful send', async () => {
    const resendClient = (provider as any).client;
    resendClient.emails.send.mockResolvedValue({
      data: { id: 'resend-msg-456' },
      error: null,
    });

    const result = await provider.send({
      to: ['a@test.com', 'b@test.com'],
      subject: 'Bulk',
      html: '<p>Hi</p>',
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('resend-msg-456');
    expect(result.provider).toBe('resend');
  });
});
