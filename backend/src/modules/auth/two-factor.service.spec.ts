import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { TwoFactorService } from './two-factor.service';
import type { UsersService } from '../users/users.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { User } from '../users/schemas/user.schema';

const updateTwoFactorSecret = jest.fn<
  Promise<void>,
  [userId: string, secret: string]
>();
const setTwoFactorEnabled = jest.fn<
  Promise<void>,
  [userId: string, enabled: boolean]
>();
const clearTwoFactor = jest.fn<Promise<void>, [userId: string]>();
const notificationsSendEmail = jest.fn<
  Promise<void>,
  [to: string, subject: string, text: string]
>();

jest.mock('speakeasy', () => ({
  generateSecret: jest.fn(),
  totp: {
    verify: jest.fn(),
  },
}));

jest.mock('qrcode', () => ({
  toDataURL: jest.fn(),
}));

const speakeasyMock = jest.requireMock('speakeasy') as unknown as {
  generateSecret: jest.Mock;
  totp: { verify: jest.Mock };
};
const qrcodeMock = jest.requireMock('qrcode') as unknown as {
  toDataURL: jest.Mock;
};

const generateSecretMock = speakeasyMock.generateSecret;
const totpVerifyMock = speakeasyMock.totp.verify;
const toDataUrlMock = qrcodeMock.toDataURL;

describe('TwoFactorService', () => {
  let service: TwoFactorService;
  let usersService: jest.Mocked<UsersService>;
  let notificationsService: jest.Mocked<NotificationsService>;

  beforeEach(() => {
    usersService = {
      updateTwoFactorSecret,
      setTwoFactorEnabled,
      clearTwoFactor,
    } as unknown as jest.Mocked<UsersService>;

    notificationsService = {
      sendEmail: notificationsSendEmail,
    } as unknown as jest.Mocked<NotificationsService>;

    const configService = {
      get: jest.fn().mockReturnValue('B2B Inventory'),
    } as unknown as ConfigService;

    service = new TwoFactorService(
      configService,
      usersService,
      notificationsService,
    );

    updateTwoFactorSecret.mockReset();
    setTwoFactorEnabled.mockReset();
    clearTwoFactor.mockReset();
    notificationsSendEmail.mockReset();
    generateSecretMock.mockReset();
    totpVerifyMock.mockReset();
    toDataUrlMock.mockReset();
  });

  it('generateSecret istifadəçiyə secret yazır və QR qaytarır', async () => {
    const user = {
      id: 'user-1',
      email: 'user@example.com',
    } as User;
    generateSecretMock.mockReturnValue({
      base32: 'BASE32SECRET',
      otpauth_url: 'otpauth://totp/B2B?secret=BASE32SECRET',
    });
    toDataUrlMock.mockResolvedValue('data:image/png;base64,QRDATA');

    const result = await service.generateSecret(user);

    expect(updateTwoFactorSecret).toHaveBeenCalledWith(
      'user-1',
      'BASE32SECRET',
    );
    expect(toDataUrlMock).toHaveBeenCalledWith(
      'otpauth://totp/B2B?secret=BASE32SECRET',
    );
    expect(result).toEqual({
      secret: 'BASE32SECRET',
      otpauthUrl: 'otpauth://totp/B2B?secret=BASE32SECRET',
      qrCodeDataUrl: 'data:image/png;base64,QRDATA',
    });
  });

  it('otpauth url olmadıqda UnauthorizedException atır', async () => {
    const user = { id: 'user-2', email: 'foo@example.com' } as User;
    generateSecretMock.mockReturnValue({
      base32: 'NOURL',
      otpauth_url: undefined,
    });

    await expect(service.generateSecret(user)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('enableTwoFactor secret yoxdursa exception qaytarır', async () => {
    const user = { id: 'user-3', email: 'a@b.com' } as unknown as User;

    await expect(service.enableTwoFactor(user, '123456')).rejects.toThrow(
      '2FA secret tapılmadı',
    );
  });

  it('enableTwoFactor token səhv olduqda exception atır', async () => {
    const user = {
      id: 'user-4',
      email: 'a@b.com',
      twoFactorSecret: 'SECRET',
    } as unknown as User;
    totpVerifyMock.mockReturnValue(false);

    await expect(service.enableTwoFactor(user, '123456')).rejects.toThrow(
      '2FA kodu yanlışdır',
    );
    expect(setTwoFactorEnabled).not.toHaveBeenCalled();
  });

  it('enableTwoFactor token düzgün olduqda aktivləşdirir və email göndərir', async () => {
    const user = {
      id: 'user-5',
      email: 'user5@example.com',
      twoFactorSecret: 'SECRET',
    } as unknown as User;
    totpVerifyMock.mockReturnValue(true);

    await service.enableTwoFactor(user, '654321');

    expect(setTwoFactorEnabled).toHaveBeenCalledWith('user-5', true);
    expect(notificationsSendEmail).toHaveBeenCalledWith(
      'user5@example.com',
      'İki faktorlu giriş aktivləşdirildi',
      expect.stringContaining('iki faktorlu autentifikasiya aktivləşdirildi'),
    );
  });

  it('disableTwoFactor secret təmizləyir və bildiriş göndərir', async () => {
    const user = {
      id: 'user-6',
      email: 'user6@example.com',
    } as unknown as User;

    await service.disableTwoFactor(user);

    expect(clearTwoFactor).toHaveBeenCalledWith('user-6');
    expect(notificationsSendEmail).toHaveBeenCalledWith(
      'user6@example.com',
      'İki faktorlu giriş deaktiv edildi',
      expect.stringContaining('deaktiv edildi'),
    );
  });
});
