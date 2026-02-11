import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Strategy, type StrategyOptions } from 'passport-jwt';
import { UsersService } from '../../users/users.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  branchId?: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private static readonly bearerPrefix = 'bearer';

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    const jwtFromRequest = (req: Request): string | null => {
      const { authorization } = req.headers ?? {};
      if (typeof authorization === 'string') {
        return JwtStrategy.extractToken(authorization);
      }
      if (authorization) {
        const values = Array.isArray(authorization)
          ? authorization
          : [authorization];
        for (const value of values) {
          const token = JwtStrategy.extractToken(value);
          if (token) return token;
        }
      }
      return null;
    };

    const secret =
      configService.get<string>('jwt.accessTokenSecret') ??
      'development-access-secret';

    // StrategyOptions passport-jwt typings expose loose `any` values that trigger
    // eslint's no-unsafe-* rules. We assert the shape manually here.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const options = {
      jwtFromRequest,
      ignoreExpiration: false,
      secretOrKey: secret,
    } as StrategyOptions;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    super(options);
  }

  async validate(payload: JwtPayload) {
    const user = await this.usersService.findById(payload.sub);
    return user;
  }

  private static extractToken(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    const [scheme, ...rest] = trimmed.split(/\s+/);
    if (scheme.toLowerCase() !== JwtStrategy.bearerPrefix) return null;
    const token = rest.join(' ').trim();
    return token.length > 0 ? token : null;
  }
}
