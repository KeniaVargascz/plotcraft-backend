import { EmailService } from '../../modules/email/email.service';
import { EmailProvider, EmailResult } from '../../modules/email/interfaces/email-provider.interface';

describe('EmailService', () => {
  const mockProvider: EmailProvider = {
    providerName: 'mock',
    send: jest.fn(),
  };

  let service: EmailService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EmailService(mockProvider);
  });

  it('sendOtpVerification should call provider.send with correct subject and tags', async () => {
    (mockProvider.send as jest.Mock).mockResolvedValue({
      success: true,
      provider: 'mock',
      messageId: 'msg-1',
    } satisfies EmailResult);

    await service.sendOtpVerification({
      to: 'user@test.com',
      username: 'testuser',
      code: '123456',
      expiresInMinutes: 10,
    });

    expect(mockProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@test.com',
        subject: 'Verifica tu cuenta en PlotCraft',
        tags: { type: 'otp', flow: 'register' },
      }),
    );
  });

  it('sendWelcome should call provider.send with username in subject', async () => {
    (mockProvider.send as jest.Mock).mockResolvedValue({
      success: true,
      provider: 'mock',
      messageId: 'msg-2',
    } satisfies EmailResult);

    await service.sendWelcome({
      to: 'user@test.com',
      username: 'testuser',
      nickname: 'Test Author',
    });

    expect(mockProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@test.com',
        subject: 'Bienvenido a PlotCraft, Test Author',
        tags: { type: 'welcome' },
      }),
    );
  });
});
