import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { parseTtlToSeconds } from './utils/ttl.util';
import { TwoFactorService } from './two-factor.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    UsersModule,
    NotificationsModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret =
          configService.get<string>('jwt.accessTokenSecret') ??
          'development-access-secret';
        const ttlRaw = configService.get<string>('jwt.accessTokenTtl');
        // MÜHİM: Access token müddətini artırdıq (default: 24 saat)
        // Əvvəlki: 900 saniyə (15 dəqiqə) - çox qısa idi
        // Yeni: 24 saat (86400 saniyə) - istifadəçi bir gün ərzində çıxmayacaq
        const expiresIn = parseTtlToSeconds(ttlRaw, 24 * 3600);
        return {
          secret,
          signOptions: { expiresIn },
        };
      },
    }),
  ],
  providers: [AuthService, JwtStrategy, TwoFactorService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
