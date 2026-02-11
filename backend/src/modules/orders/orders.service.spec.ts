import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { createMongooseModelMock } from '../../test/mongoose-model-mock';
import { CartsService } from '../carts/carts.service';
import { StockCalculationService } from '../transactions/stock-calculation.service';

jest.mock('../tenants/schemas/tenant.schema', () => ({
  Tenant: class Tenant {},
}));

const createUser = () => ({
  id: 'user-1',
  _id: { toString: () => 'user-1' },
  email: 'user@example.com',
  role: 'USER',
});

describe('OrdersService', () => {
  let orderModel: ReturnType<typeof createMongooseModelMock>;
  let orderItemModel: ReturnType<typeof createMongooseModelMock>;
  let branchModel: ReturnType<typeof createMongooseModelMock>;
  let inventoryModel: ReturnType<typeof createMongooseModelMock>;
  let userModel: ReturnType<typeof createMongooseModelMock>;
  let cartsService: {
    getOrCreateCart: jest.Mock;
    clearCart: jest.Mock;
    clearGeneralCart?: jest.Mock;
  };
  let stockCalculationService: { calculateStockForAllProducts: jest.Mock };
  let service: OrdersService;

  beforeEach(() => {
    orderModel = createMongooseModelMock();
    orderItemModel = createMongooseModelMock();
    branchModel = createMongooseModelMock();
    inventoryModel = createMongooseModelMock();
    userModel = createMongooseModelMock();
    cartsService = {
      getOrCreateCart: jest.fn().mockResolvedValue({ id: 'cart-1', items: [] }),
      clearCart: jest.fn().mockResolvedValue(undefined),
      clearGeneralCart: jest.fn().mockResolvedValue(undefined),
      getOrCreateGeneralCart: jest.fn(),
    };
    stockCalculationService = {
      calculateStockForAllProducts: jest.fn().mockResolvedValue(undefined),
    };

    service = new OrdersService(
      orderModel as never,
      orderItemModel as never,
      branchModel as never,
      inventoryModel as never,
      userModel as never,
      cartsService as never,
      { emit: jest.fn() } as never,
      stockCalculationService as never,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createOrderFromCart', () => {
    it('throw NotFoundException when branch is missing', async () => {
      branchModel.mockFindByIdResult(null);
      const user = createUser();

      await expect(
        service.createOrderFromCart('507f1f77bcf86cd799439011', user),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throw BadRequestException when cart is empty', async () => {
      const branchId = '507f1f77bcf86cd799439011';
      const branch = { _id: { toString: () => branchId }, name: 'Filial' };
      branchModel.mockFindByIdResult(branch);
      cartsService.getOrCreateCart.mockResolvedValue({
        id: 'cart-1',
        items: [],
      });
      const user = createUser();

      await expect(
        service.createOrderFromCart(branchId, user),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throw BadRequestException when inventory is insufficient', async () => {
      const branchId = '507f1f77bcf86cd799439011';
      const branch = { _id: { toString: () => branchId }, name: 'Filial' };
      const product = {
        id: '507f1f77bcf86cd799439020',
        code: 'PRD001',
        name: 'P',
        price: 10,
      };
      branchModel.mockFindByIdResult(branch);
      cartsService.getOrCreateCart.mockResolvedValue({
        id: 'cart-1',
        items: [{ product, quantity: 10 }],
      });
      inventoryModel.mockFindOneResult({ availableQty: 5 });
      const user = createUser();

      await expect(
        service.createOrderFromCart(branchId, user),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
