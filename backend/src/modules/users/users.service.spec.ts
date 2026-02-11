import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { createMongooseModelMock } from '../../test/mongoose-model-mock';
import { UserRole } from '../../common/constants/roles.enum';

jest.mock('../tenants/schemas/tenant.schema', () => ({
  Tenant: class Tenant {},
}));
jest.mock('bcrypt', () => ({
  compare: jest.fn().mockResolvedValue(true),
  hash: jest.fn().mockResolvedValue('hashed'),
}));

describe('UsersService', () => {
  let service: UsersService;
  let userModel: ReturnType<typeof createMongooseModelMock>;
  let configModel: ReturnType<typeof createMongooseModelMock>;
  let branchModel: ReturnType<typeof createMongooseModelMock>;

  beforeEach(() => {
    userModel = createMongooseModelMock();
    configModel = createMongooseModelMock();
    branchModel = createMongooseModelMock();

    service = new UsersService(
      userModel as never,
      configModel as never,
      branchModel as never,
    );
  });

  it('findByEmail returns user when found', async () => {
    const user = {
      _id: { toString: () => 'u1' },
      email: 'u@x.com',
      passwordHash: 'h',
      role: UserRole.USER,
    };
    userModel.mockFindOneResult(user);

    const result = await service.findByEmail('u@x.com');

    expect(result).not.toBeNull();
    expect(result?.email).toBe('u@x.com');
  });

  it('findByEmail returns null when not found', async () => {
    userModel.mockFindOneResult(null);

    const result = await service.findByEmail('missing@x.com');

    expect(result).toBeNull();
  });

  it('countUsers returns count', async () => {
    userModel.mockCountResult(5);

    const result = await service.countUsers();

    expect(result).toBe(5);
  });
});
