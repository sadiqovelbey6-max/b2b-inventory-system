import { BranchesService } from './branches.service';
import { createMongooseModelMock } from '../../test/mongoose-model-mock';
import type { Branch } from './schemas/branch.schema';

jest.mock('../tenants/schemas/tenant.schema', () => ({
  Tenant: class Tenant {},
}));

const createBranch = (
  overrides?: Partial<Record<string, unknown>>,
): Record<string, unknown> => ({
  _id: { toString: () => 'branch-1' },
  id: 'branch-1',
  code: 'TEST',
  name: 'Test Filialı',
  ...overrides,
});

describe('BranchesService', () => {
  let branchModel: ReturnType<typeof createMongooseModelMock>;
  let usersService: { countByBranch: jest.Mock };
  let service: BranchesService;

  beforeEach(() => {
    branchModel = createMongooseModelMock();
    usersService = { countByBranch: jest.fn().mockResolvedValue(0) };
    service = new BranchesService(branchModel as never, usersService as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('findAll', () => {
    it('returns branches ordered by name', async () => {
      const branches = [
        createBranch({
          _id: { toString: () => 'b1' },
          id: 'b1',
          name: 'Bakı Filialı',
        }),
        createBranch({
          _id: { toString: () => 'b2' },
          id: 'b2',
          name: 'Gəncə Filialı',
        }),
      ];
      branchModel.mockFindResult(branches);

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Bakı Filialı');
      expect(branchModel.find).toHaveBeenCalledWith({});
      expect(branchModel.find().sort).toHaveBeenCalledWith({ name: 1 });
    });

    it('returns empty array when no branches exist', async () => {
      branchModel.mockFindResult([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });

    it('filters by tenantId when provided', async () => {
      const branches = [createBranch()];
      branchModel.mockFindResult(branches);

      const result = await service.findAll('tenant-1');

      expect(result).toHaveLength(1);
      expect(branchModel.find).toHaveBeenCalledWith({ tenant: 'tenant-1' });
    });
  });

  describe('findById', () => {
    it('returns branch when found', async () => {
      const branch = createBranch();
      branchModel.mockFindByIdResult(branch);

      const result = await service.findById('branch-1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('branch-1');
      expect(branchModel.findById).toHaveBeenCalledWith('branch-1');
    });

    it('returns null when branch not found', async () => {
      branchModel.mockFindByIdResult(null);

      const result = await service.findById('missing-branch');

      expect(result).toBeNull();
    });
  });

  describe('ensureBranch', () => {
    it('returns existing branch when found by code', async () => {
      const obj = { code: 'EXIST', name: 'Mövcud Filial' };
      const existing = {
        toObject: () => obj,
        _id: { toString: () => 'branch-1' },
      };
      branchModel.mockFindOneResult(existing);

      const result = await service.ensureBranch('EXIST', 'Mövcud Filial');

      expect(result).toMatchObject({ code: 'EXIST', id: 'branch-1' });
      expect(branchModel.create).not.toHaveBeenCalled();
    });

    it('creates new branch when not found', async () => {
      const obj = { code: 'NEW', name: 'Yeni Filial' };
      const newBranch = {
        toObject: () => obj,
        _id: { toString: () => 'new-id' },
      };
      branchModel.mockFindOneResult(null);
      branchModel.create.mockResolvedValue(newBranch);

      const result = await service.ensureBranch('NEW', 'Yeni Filial');

      expect(result).toMatchObject({ code: 'NEW', id: 'new-id' });
      expect(branchModel.create).toHaveBeenCalledWith({
        code: 'NEW',
        name: 'Yeni Filial',
      });
    });
  });
});
