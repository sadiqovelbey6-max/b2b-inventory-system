import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { generateSecret, totp, type GeneratedSecret } from 'speakeasy';
import { toDataURL } from 'qrcode';

export interface TwoFactorSecretResult {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

@Injectable()
export class TwoFactorService {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async generateSecret(user: {
    id: string;
    email: string;
  }): Promise<TwoFactorSecretResult> {
    const issuer =
      this.configService.get<string>('twoFactor.issuer') ?? 'B2B Inventory';
    const secret: GeneratedSecret = generateSecret({
      name: `${issuer} (${user.email})`,
      issuer,
    });

    if (!secret.otpauth_url) {
      throw new UnauthorizedException(
        '2FA üçün secret generasiya edilə bilmədi',
      );
    }

    await this.usersService.updateTwoFactorSecret(user.id, secret.base32);
    const qrCodeDataUrl = await toDataURL(secret.otpauth_url);

    return {
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url,
      qrCodeDataUrl,
    };
  }

  async enableTwoFactor(
    user: { id: string; email: string; twoFactorSecret?: string | null },
    token: string,
  ) {
    if (!user.twoFactorSecret) {
      throw new UnauthorizedException(
        '2FA secret tapılmadı. Əvvəlcə setup edin.',
      );
    }

    const valid = this.verifyToken(user.twoFactorSecret, token);
    if (!valid) {
      throw new UnauthorizedException('2FA kodu yanlışdır');
    }

    await this.usersService.setTwoFactorEnabled(user.id, true);
    await this.notificationsService.sendEmail(
      user.email,
      'İki faktorlu giriş aktivləşdirildi',
      'Hesabınız üçün iki faktorlu autentifikasiya aktivləşdirildi. Əgər bu addımı siz etməmisinizsə, dərhal adminlə əlaqə saxlayın.',
    );
  }

  async disableTwoFactor(user: { id: string; email: string }) {
    await this.usersService.clearTwoFactor(user.id);
    await this.notificationsService.sendEmail(
      user.email,
      'İki faktorlu giriş deaktiv edildi',
      'Hesabınız üçün iki faktorlu autentifikasiya deaktiv edildi. Əgər bu addımı siz etməmisinizsə, dərhal adminlə əlaqə saxlayın.',
    );
  }

  verifyToken(secret: string, token: string) {
    return totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1,
    });
  }
}
