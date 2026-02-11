import { ProductsService } from './products.service';
import { createMongooseModelMock } from '../../test/mongoose-model-mock';

jest.mock('../tenants/schemas/tenant.schema', () => ({
  Tenant: class Tenant {},
}));

const stockCalcMock = {
  calculateStockForAllProducts: jest.fn().mockResolvedValue(undefined),
};

describe('ProductsService', () => {
  let productModel: ReturnType<typeof createMongooseModelMock>;
  let substituteModel: ReturnType<typeof createMongooseModelMock>;
  let inventoryModel: ReturnType<typeof createMongooseModelMock>;
  let branchModel: ReturnType<typeof createMongooseModelMock>;
  let cartItemModel: ReturnType<typeof createMongooseModelMock>;
  let orderItemModel: ReturnType<typeof createMongooseModelMock>;
  let transactionModel: ReturnType<typeof createMongooseModelMock>;
  let adjustmentModel: ReturnType<typeof createMongooseModelMock>;
  let service: ProductsService;

  beforeEach(() => {
    productModel = createMongooseModelMock();
    substituteModel = createMongooseModelMock();
    inventoryModel = createMongooseModelMock();
    branchModel = createMongooseModelMock();
    cartItemModel = createMongooseModelMock();
    orderItemModel = createMongooseModelMock();
    transactionModel = createMongooseModelMock();
    adjustmentModel = createMongooseModelMock();
    service = new ProductsService(
      productModel as never,
      substituteModel as never,
      inventoryModel as never,
      branchModel as never,
      cartItemModel as never,
      orderItemModel as never,
      transactionModel as never,
      adjustmentModel as never,
      stockCalcMock as never,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getCategories', () => {
    it('returns predefined categories', async () => {
      const result = await service.getCategories();

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain('Yağ və mayelər');
    });
  });

  describe('listProducts', () => {
    it('returns products with inventory structure', async () => {
      const products = [
        {
          _id: { toString: () => 'p1' },
          code: 'PRD001',
          name: 'Məhsul',
          price: 10,
          branch: null,
          tenant: null,
        },
      ];
      productModel.mockFindResult(products);
      inventoryModel.mockFindResult([]);

      const result = await service.listProducts();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'p1',
        code: 'PRD001',
        name: 'Məhsul',
        price: 10,
      });
    });
  });

  describe('lookupCode', () => {
    it('returns empty array when no products found', async () => {
      productModel.mockFindResult([]);

      const result = await service.lookupCode('NONEXISTENT');

      expect(result).toEqual([]);
    });

    it('returns products with inventory when branchId provided', async () => {
      const products = [
        { _id: { toString: () => 'p1' }, code: 'PRD001', name: 'P', price: 10 },
      ];
      const inventories = [
        {
          product: { _id: { toString: () => 'p1' } },
          branch: { _id: { toString: () => 'b1' } },
          availableQty: 15,
          inTransitQty: 0,
          reservedQty: 0,
        },
      ];
      productModel.mockFindResult(products);
      inventoryModel.mockFindResult(inventories);
      substituteModel.mockFindResult([]);

      const result = await service.lookupCode('PRD001', 'b1');

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('PRD001');
      expect(result[0].inventory.availableQty).toBe(15);
    });
  });
});
