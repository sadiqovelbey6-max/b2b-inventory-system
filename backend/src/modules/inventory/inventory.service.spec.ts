import { BadRequestException } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { createMongooseModelMock } from '../../test/mongoose-model-mock';

jest.mock('../tenants/schemas/tenant.schema', () => ({
  Tenant: class Tenant {},
}));

const createBranch = () => ({
  _id: { toString: () => 'branch-1' },
  name: 'Test Filialı',
  code: 'TEST',
});
const createProduct = () => ({
  _id: { toString: () => 'product-1' },
  code: 'PRD001',
  name: 'Test Məhsul',
});

describe('InventoryService', () => {
  let inventoryModel: ReturnType<typeof createMongooseModelMock>;
  let branchModel: ReturnType<typeof createMongooseModelMock>;
  let productModel: ReturnType<typeof createMongooseModelMock>;
  let service: InventoryService;

  beforeEach(() => {
    inventoryModel = createMongooseModelMock();
    branchModel = createMongooseModelMock();
    productModel = createMongooseModelMock();
    service = new InventoryService(
      inventoryModel as never,
      branchModel as never,
      productModel as never,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('ensureInventory', () => {
    it('throw BadRequestException when branch is missing', async () => {
      branchModel.mockFindByIdResult(null);
      productModel.mockFindByIdResult(createProduct());

      await expect(
        service.ensureInventory('missing-branch', 'product-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throw BadRequestException when product is missing', async () => {
      branchModel.mockFindByIdResult(createBranch());
      productModel.mockFindByIdResult(null);

      await expect(
        service.ensureInventory('branch-1', 'missing-product'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates new inventory when not exists', async () => {
      const branch = createBranch();
      const product = createProduct();
      const newInv = {
        toObject: () => ({
          _id: 'inv-1',
          branch,
          product,
          availableQty: 10,
          inTransitQty: 2,
          reservedQty: 1,
        }),
        _id: { toString: () => 'inv-1' },
      };
      branchModel.mockFindByIdResult(branch);
      productModel.mockFindByIdResult(product);
      inventoryModel.mockFindOneResult(null);
      inventoryModel.create.mockResolvedValue(newInv);

      const result = await service.ensureInventory('branch-1', 'product-1', {
        availableQty: 10,
        inTransitQty: 2,
        reservedQty: 1,
      });

      expect(result).not.toBeNull();
      expect(result?.id).toBe('inv-1');
      expect(inventoryModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          branch: 'branch-1',
          product: 'product-1',
          availableQty: 10,
          inTransitQty: 2,
          reservedQty: 1,
        }),
      );
    });

    it('uses default quantities when not provided', async () => {
      const branch = createBranch();
      const product = createProduct();
      const newInv = {
        toObject: () => ({
          _id: 'inv-1',
          branch,
          product,
          availableQty: 0,
          inTransitQty: 0,
          reservedQty: 0,
        }),
        _id: { toString: () => 'inv-1' },
      };
      branchModel.mockFindByIdResult(branch);
      productModel.mockFindByIdResult(product);
      inventoryModel.mockFindOneResult(null);
      inventoryModel.create.mockResolvedValue(newInv);

      const result = await service.ensureInventory('branch-1', 'product-1');

      expect(result).not.toBeNull();
      expect(inventoryModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          availableQty: 0,
          inTransitQty: 0,
          reservedQty: 0,
        }),
      );
    });
  });

  describe('listAll', () => {
    it('returns inventories with id', async () => {
      const docs = [
        {
          _id: { toString: () => 'i1' },
          branch: {},
          product: {},
          availableQty: 5,
        },
      ];
      inventoryModel.mockFindResult(docs);

      const result = await service.listAll();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('i1');
    });
  });
});
