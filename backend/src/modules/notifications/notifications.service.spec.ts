import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { createTransport } from 'nodemailer';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

const createConfigService = (values: Record<string, unknown>) =>
  ({
    get: (key: string) => values[key],
  }) as unknown as ConfigService;

describe('NotificationsService', () => {
  const warnSpy = jest
    .spyOn(Logger.prototype, 'warn')
    .mockImplementation(() => undefined);
  const logSpy = jest
    .spyOn(Logger.prototype, 'log')
    .mockImplementation(() => undefined);
  const errorSpy = jest
    .spyOn(Logger.prototype, 'error')
    .mockImplementation(() => undefined);

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    warnSpy.mockRestore();
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('SMTP konfiqurasiya olmadıqda mock log yazır', async () => {
    const configService = createConfigService({});
    const service = new NotificationsService(configService);

    await expect(
      service.sendEmail('test@example.com', 'Sub', 'Body'),
    ).resolves.toBeUndefined();

    expect(createTransport).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('[DEV] Email mock'),
    );
  });

  it('Konfiqurasiya olduqda transporter vasitəsilə email göndərir', async () => {
    const sendMail = jest.fn().mockResolvedValue({ messageId: '123' });
    (createTransport as jest.Mock).mockReturnValue({ sendMail });

    const configService = createConfigService({
      'mail.host': 'smtp.example.com',
      'mail.port': 587,
      'mail.user': 'user@example.com',
      'mail.password': 'secret',
      'mail.from': 'noreply@example.com',
      'mail.secure': false,
    });

    const service = new NotificationsService(configService);
    await service.sendEmail(
      'dest@example.com',
      'Yeni sifariş',
      'Sadə mətn',
      '<p>Sınaq</p>',
    );

    expect(createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: { user: 'user@example.com', pass: 'secret' },
    });

    expect(sendMail).toHaveBeenCalledWith({
      from: 'noreply@example.com',
      to: 'dest@example.com',
      subject: 'Yeni sifariş',
      text: 'Sadə mətn',
      html: '<p>Sınaq</p>',
    });
  });

  it('Göndəriş uğursuz olduqda xətanı yenidən atır', async () => {
    const sendMail = jest
      .fn()
      .mockRejectedValue(new Error('SMTP bağlantısı yoxdur'));
    (createTransport as jest.Mock).mockReturnValue({ sendMail });

    const configService = createConfigService({
      'mail.host': 'smtp.example.com',
      'mail.port': 465,
      'mail.user': 'user@example.com',
      'mail.password': 'secret',
      'mail.from': 'noreply@example.com',
      'mail.secure': true,
    });

    const service = new NotificationsService(configService);

    await expect(
      service.sendEmail('dest@example.com', 'Başlıq', 'Mətn'),
    ).rejects.toThrow('SMTP bağlantısı yoxdur');

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('E-poçt göndərilə bilmədi'),
    );
  });
});
