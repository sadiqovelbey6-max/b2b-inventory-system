import { NotFoundException } from '@nestjs/common';
import { CartsService } from './carts.service';
import { createMongooseModelMock } from '../../test/mongoose-model-mock';

jest.mock('../tenants/schemas/tenant.schema', () => ({
  Tenant: class Tenant {},
}));

describe('CartsService', () => {
  let cartModel: ReturnType<typeof createMongooseModelMock>;
  let cartItemModel: ReturnType<typeof createMongooseModelMock>;
  let branchModel: ReturnType<typeof createMongooseModelMock>;
  let productModel: ReturnType<typeof createMongooseModelMock>;
  let inventoryModel: ReturnType<typeof createMongooseModelMock>;
  let service: CartsService;

  beforeEach(() => {
    cartModel = createMongooseModelMock();
    cartItemModel = createMongooseModelMock();
    branchModel = createMongooseModelMock();
    productModel = createMongooseModelMock();
    inventoryModel = createMongooseModelMock();
    service = new CartsService(
      cartModel as never,
      cartItemModel as never,
      branchModel as never,
      productModel as never,
      inventoryModel as never,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const validId = '507f1f77bcf86cd799439011';

  describe('getOrCreateCart', () => {
    it('returns existing cart when found', async () => {
      const branch = { _id: { toString: () => validId }, name: 'Filial' };
      const cart = { _id: { toString: () => validId }, branch, totalAmount: 0 };
      cartModel.mockFindOneResult(cart);
      cartItemModel.mockFindResult([]);
      branchModel.mockFindByIdResult(branch);

      const result = await service.getOrCreateCart(validId);

      expect(result).toBeDefined();
      expect(cartModel.findOne).toHaveBeenCalled();
      expect(cartModel.create).not.toHaveBeenCalled();
    });

    it('creates new cart when not found', async () => {
      const branch = { _id: { toString: () => validId }, name: 'Filial' };
      const createdCart = {
        toObject: () => ({ _id: validId, branch, totalAmount: 0 }),
        _id: { toString: () => validId },
      };
      cartModel.mockFindOneResult(null);
      branchModel.mockFindByIdResult(branch);
      cartModel.create.mockResolvedValue(createdCart);
      cartItemModel.mockFindResult([]);

      const result = await service.getOrCreateCart(validId);

      expect(result).toBeDefined();
      expect(cartModel.create).toHaveBeenCalled();
    });

    it('throw NotFoundException when branch is missing', async () => {
      cartModel.mockFindOneResult(null);
      branchModel.mockFindByIdResult(null);

      await expect(service.getOrCreateCart(validId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
