import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { compare, hash } from 'bcrypt';
import { UsersService } from '../users/users.service';
import { UserRole } from '../../common/constants/roles.enum';
import { parseTtlToSeconds } from './utils/ttl.util';
import {
  TwoFactorService,
  type TwoFactorSecretResult,
} from './two-factor.service';

interface RegisterPayload {
  email: string;
  password: string;
  branchId?: string;
  firstName?: string;
  lastName?: string;
}

interface LoginPayload {
  email: string;
  password: string;
  twoFactorCode?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly twoFactorService: TwoFactorService,
  ) {}

  async register(payload: RegisterPayload) {
    const passwordHash = await this.hashPassword(payload.password);
    const user = await this.usersService.createUser({
      email: payload.email,
      passwordHash,
      role: UserRole.USER,
      branchId: payload.branchId,
      firstName: payload.firstName,
      lastName: payload.lastName,
    });
    if (!user) throw new BadRequestException('İstifadəçi yaradıla bilmədi');

    const tokens = await this.generateTokens(user);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  async login(payload: LoginPayload) {
    this.logger.debug(`Login attempt: ${payload.email.toLowerCase()}`);

    const user = await this.usersService.findByEmail(
      payload.email.toLowerCase(),
    );

    if (!user) {
      this.logger.debug(`User not found: ${payload.email.toLowerCase()}`);
      throw new UnauthorizedException('Email və ya şifrə yanlışdır');
    }

    const u = user as Record<string, unknown>;

    const passwordValid = await compare(
      payload.password,
      u.passwordHash as string,
    );
    if (!passwordValid) {
      this.logger.debug(`Invalid password for user: ${u.email}`);
      throw new UnauthorizedException('Email və ya şifrə yanlışdır');
    }

    if (!u.isActive) {
      this.logger.warn(`User is inactive: ${u.email}`);
      throw new BadRequestException('İstifadəçi deaktiv edilib');
    }

    if (u.twoFactorEnabled) {
      if (!u.twoFactorSecret) {
        throw new UnauthorizedException('2FA secret tapılmadı');
      }
      if (!payload.twoFactorCode) {
        throw new UnauthorizedException('2FA kodu tələb olunur');
      }
      const valid = this.twoFactorService.verifyToken(
        u.twoFactorSecret as string,
        payload.twoFactorCode,
      );
      if (!valid) {
        throw new UnauthorizedException('2FA kodu yanlışdır');
      }
    }

    const userId = (u.id ??
      (u._id as { toString?: () => string })?.toString?.()) as string;
    if (userId) await this.usersService.updateLastLogin(userId);

    const tokens = await this.generateTokens(user);
    const sanitizedUser = this.sanitizeUser(user);
    this.logger.log(
      `Login successful: ${(user as Record<string, unknown>).email}`,
    );

    return {
      user: sanitizedUser,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  private async hashPassword(password: string) {
    const saltRounds = 10;
    return hash(password, saltRounds);
  }

  async generateTokens(
    user: Record<string, unknown> & {
      id?: string;
      branch?: { id?: string; _id?: { toString: () => string } };
    },
  ): Promise<TokenPair> {
    const branchId =
      user.branch?.id ??
      (
        user.branch as { _id?: { toString: () => string } }
      )?._id?.toString?.() ??
      null;
    const payload = {
      sub: user.id ?? (user._id as { toString?: () => string })?.toString?.(),
      email: user.email,
      role: user.role,
      branchId,
    };

    const accessToken = await this.jwtService.signAsync(payload);
    const refreshSecret =
      this.configService.get<string>('jwt.refreshTokenSecret') ??
      'development-refresh-secret';
    const refreshExpiresRaw = this.configService.get<string | number>(
      'jwt.refreshTokenTtl',
    );
    const refreshExpiresIn = parseTtlToSeconds(
      refreshExpiresRaw,
      7 * 24 * 3600,
    );
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: refreshSecret,
      expiresIn: refreshExpiresIn,
    });

    return { accessToken, refreshToken };
  }

  sanitizeUser(user: Record<string, unknown>) {
    const id = (user.id ??
      (user._id as { toString?: () => string })?.toString?.()) as string;
    const branch = user.branch as Record<string, unknown> | null | undefined;
    const tenant = user.tenant as Record<string, unknown> | null | undefined;
    const sanitized: Record<string, unknown> = {
      id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      isActive: user.isActive,
      twoFactorEnabled: user.twoFactorEnabled,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
      branch: branch
        ? {
            id:
              branch.id ??
              (branch._id as { toString?: () => string })?.toString?.(),
            name: branch.name,
            code: branch.code,
          }
        : null,
      tenant: tenant
        ? {
            id:
              tenant.id ??
              (tenant._id as { toString?: () => string })?.toString?.(),
            name: tenant.name,
          }
        : null,
    };
    return sanitized;
  }

  async initiateTwoFactor(userId: string): Promise<TwoFactorSecretResult> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('İstifadəçi tapılmadı');
    const u = user as Record<string, unknown>;
    return this.twoFactorService.generateSecret({
      id: (u.id ??
        (u._id as { toString?: () => string })?.toString?.()) as string,
      email: (u.email as string) ?? '',
    });
  }

  async enableTwoFactor(userId: string, token: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('İstifadəçi tapılmadı');
    const u = user as Record<string, unknown>;
    await this.twoFactorService.enableTwoFactor(
      {
        id: (u.id ??
          (u._id as { toString?: () => string })?.toString?.()) as string,
        email: (u.email as string) ?? '',
        twoFactorSecret: u.twoFactorSecret as string | null | undefined,
      },
      token,
    );
    const updated = await this.usersService.findById(userId);
    return this.sanitizeUser(updated!);
  }

  async disableTwoFactor(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('İstifadəçi tapılmadı');
    const u = user as Record<string, unknown>;
    await this.twoFactorService.disableTwoFactor({
      id: (u.id ??
        (u._id as { toString?: () => string })?.toString?.()) as string,
      email: (u.email as string) ?? '',
    });
    const updated = await this.usersService.findById(userId);
    return this.sanitizeUser(updated!);
  }

  async refreshTokens(
    refreshToken: string,
  ): Promise<TokenPair & { user: any }> {
    try {
      const refreshSecret =
        this.configService.get<string>('jwt.refreshTokenSecret') ??
        'development-refresh-secret';

      // Refresh token-i verify et
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: refreshSecret,
      });

      // User-i tap
      const user = await this.usersService.findById(payload.sub);
      if (!user) throw new UnauthorizedException('İstifadəçi tapılmadı');

      const u = user as Record<string, unknown>;
      if (!u.isActive)
        throw new UnauthorizedException('İstifadəçi deaktiv edilib');

      // Yeni token-lar yarad
      const tokens = await this.generateTokens(u);
      const sanitizedUser = this.sanitizeUser(u);

      return {
        ...tokens,
        user: sanitizedUser,
      };
    } catch (error) {
      throw new UnauthorizedException(
        'Refresh token etibarsızdır və ya müddəti bitib',
      );
    }
  }
}
