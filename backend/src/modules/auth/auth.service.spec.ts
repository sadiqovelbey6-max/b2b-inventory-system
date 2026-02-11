import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import type { UsersService } from '../users/users.service';
import type { TwoFactorService } from './two-factor.service';
import type { User } from '../users/schemas/user.schema';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue('hashed-password'),
}));

const bcryptMock = jest.requireMock('bcrypt') as unknown as {
  compare: jest.MockedFunction<(typeof import('bcrypt'))['compare']>;
  hash: jest.Mock;
};
const compareMock = bcryptMock.compare;

const createUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-1',
    email: 'user@example.com',
    passwordHash: 'hashed',
    role: 'USER',
    isActive: true,
    twoFactorEnabled: false,
    twoFactorSecret: null,
    branch: null,
    ...overrides,
  }) as unknown as User;

describe('AuthService', () => {
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;
  let twoFactorService: jest.Mocked<TwoFactorService>;
  let authService: AuthService;
  let findByEmailMock: jest.Mock<Promise<User | null>, [string]>;
  let findByIdMock: jest.Mock<Promise<User | null>, [string]>;
  let updateLastLoginMock: jest.Mock<Promise<void>, [string]>;
  let signAsyncMock: jest.Mock<Promise<string>, [unknown, unknown?]>;
  let verifyTokenMock: jest.Mock<boolean, [string, string]>;
  let enableTwoFactorMock: jest.Mock<Promise<void>, [User, string]>;
  let disableTwoFactorMock: jest.Mock<Promise<void>, [User]>;
  let getConfigMock: jest.Mock<unknown, [string]>;

  beforeEach(() => {
    findByEmailMock = jest.fn<Promise<User | null>, [string]>();
    findByIdMock = jest.fn<Promise<User | null>, [string]>();
    updateLastLoginMock = jest.fn<Promise<void>, [string]>();
    signAsyncMock = jest
      .fn<Promise<string>, [unknown, unknown?]>()
      .mockResolvedValue('token');
    verifyTokenMock = jest.fn<boolean, [string, string]>();
    enableTwoFactorMock = jest.fn<Promise<void>, [User, string]>();
    disableTwoFactorMock = jest.fn<Promise<void>, [User]>();
    getConfigMock = jest
      .fn<unknown, [string]>()
      .mockImplementation((key: string) => {
        if (key === 'jwt.refreshTokenSecret') return 'refresh-secret';
        if (key === 'jwt.refreshTokenTtl') return 3600;
        return undefined;
      });

    usersService = {
      createUser: jest.fn(),
      findByEmail: findByEmailMock,
      findById: findByIdMock,
      updateLastLogin: updateLastLoginMock,
    } as unknown as jest.Mocked<UsersService>;

    jwtService = {
      signAsync: signAsyncMock,
    } as unknown as jest.Mocked<JwtService>;

    configService = {
      get: getConfigMock,
    } as unknown as jest.Mocked<ConfigService>;

    twoFactorService = {
      generateSecret: jest.fn(),
      enableTwoFactor: enableTwoFactorMock,
      disableTwoFactor: disableTwoFactorMock,
      verifyToken: verifyTokenMock,
    } as unknown as jest.Mocked<TwoFactorService>;

    authService = new AuthService(
      usersService,
      jwtService,
      configService,
      twoFactorService,
    );

    compareMock.mockReset();
    signAsyncMock.mockClear();
  });

  it('login istifadəçi tapılmadıqda UnauthorizedException qaytarır', async () => {
    findByEmailMock.mockResolvedValue(null);

    await expect(
      authService.login({ email: 'user@example.com', password: 'secret' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('login parol səhv olduqda UnauthorizedException qaytarır', async () => {
    const user = createUser();
    findByEmailMock.mockResolvedValue(user);
    compareMock.mockResolvedValue(false);

    await expect(
      authService.login({ email: 'user@example.com', password: 'wrong' }),
    ).rejects.toThrow('Email və ya şifrə yanlışdır');
  });

  it('login deaktiv istifadəçidə BadRequestException qaytarır', async () => {
    const user = createUser({ isActive: false });
    findByEmailMock.mockResolvedValue(user);
    compareMock.mockResolvedValue(true);

    await expect(
      authService.login({ email: 'user@example.com', password: 'secret' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('login 2FA aktiv olduqda kod tələb edir', async () => {
    const user = createUser({
      twoFactorEnabled: true,
      twoFactorSecret: 'SECRET',
    });
    findByEmailMock.mockResolvedValue(user);
    compareMock.mockResolvedValue(true);

    await expect(
      authService.login({ email: 'user@example.com', password: 'secret' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('login 2FA kodu yanlışdırsa UnauthorizedException qaytarır', async () => {
    const user = createUser({
      twoFactorEnabled: true,
      twoFactorSecret: 'SECRET',
    });
    findByEmailMock.mockResolvedValue(user);
    compareMock.mockResolvedValue(true);
    verifyTokenMock.mockReturnValue(false);

    await expect(
      authService.login({
        email: 'user@example.com',
        password: 'secret',
        twoFactorCode: '000000',
      }),
    ).rejects.toThrow('2FA kodu yanlışdır');
  });

  it('login uğurlu olduqda token və sanitize olunmuş user qaytarır', async () => {
    const user = createUser({
      twoFactorEnabled: true,
      twoFactorSecret: 'SECRET',
      branch: { id: 'branch-1' } as unknown as User['branch'],
    });
    findByEmailMock.mockResolvedValue(user);
    compareMock.mockResolvedValue(true);
    verifyTokenMock.mockReturnValue(true);

    const result = await authService.login({
      email: 'user@example.com',
      password: 'secret',
      twoFactorCode: '123456',
    });

    expect(updateLastLoginMock).toHaveBeenCalledWith('user-1');
    expect(signAsyncMock).toHaveBeenCalledTimes(2);
    expect(result.user.passwordHash).toBeUndefined();
    expect(result.user.twoFactorSecret).toBeUndefined();
    expect(result.accessToken).toBe('token');
    expect(result.refreshToken).toBe('token');
  });

  it('initiateTwoFactor istifadəçi tapmadıqda UnauthorizedException qaytarır', async () => {
    findByIdMock.mockResolvedValue(null);

    await expect(authService.initiateTwoFactor('missing')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('enableTwoFactor istifadəçi tapdıqdan sonra TwoFactorService çağırır', async () => {
    const user = createUser({
      twoFactorEnabled: false,
      twoFactorSecret: 'SECRET',
    });
    findByIdMock.mockResolvedValueOnce(user).mockResolvedValueOnce({
      ...user,
      twoFactorEnabled: true,
    });

    await authService.enableTwoFactor('user-1', '123456');

    expect(enableTwoFactorMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1', email: 'user@example.com' }),
      '123456',
    );
  });

  it('disableTwoFactor istifadəçi tapdıqdan sonra TwoFactorService çağırır', async () => {
    const user = createUser({
      twoFactorEnabled: true,
    });
    findByIdMock.mockResolvedValueOnce(user).mockResolvedValueOnce({
      ...user,
      twoFactorEnabled: false,
    });

    await authService.disableTwoFactor('user-1');

    expect(disableTwoFactorMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1', email: 'user@example.com' }),
    );
  });
});
