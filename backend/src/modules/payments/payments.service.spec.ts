import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { createMongooseModelMock } from '../../test/mongoose-model-mock';
import { PaymentStatus } from '../../common/constants/payment-status.enum';

jest.mock('../tenants/schemas/tenant.schema', () => ({
  Tenant: class Tenant {},
}));

describe('PaymentsService', () => {
  let paymentModel: ReturnType<typeof createMongooseModelMock>;
  let orderModel: ReturnType<typeof createMongooseModelMock>;
  let invoiceModel: ReturnType<typeof createMongooseModelMock>;
  let service: PaymentsService;

  beforeEach(() => {
    paymentModel = createMongooseModelMock();
    orderModel = createMongooseModelMock();
    invoiceModel = createMongooseModelMock();
    service = new PaymentsService(
      paymentModel as never,
      orderModel as never,
      invoiceModel as never,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('recordPayment', () => {
    it('throw NotFoundException when order is missing', async () => {
      orderModel.mockFindByIdResult(null);

      await expect(
        service.recordPayment({
          orderId: 'missing-order',
          amount: 100,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throw BadRequestException when invoiceId provided but invoice not found', async () => {
      const order = { _id: { toString: () => 'ord-1' } };
      orderModel.mockFindByIdResult(order);
      invoiceModel.mockFindByIdResult(null);

      await expect(
        service.recordPayment({
          orderId: 'ord-1',
          invoiceId: 'missing-inv',
          amount: 100,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates payment successfully', async () => {
      const orderId = '507f1f77bcf86cd799439011';
      const order = { _id: { toString: () => orderId } };
      const payment = {
        _id: { toString: () => '507f1f77bcf86cd799439012' },
        amount: 100,
        status: PaymentStatus.PENDING,
        method: 'manual_bank',
        reference: 'REF-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      orderModel.mockFindByIdResult(order);
      paymentModel.create.mockResolvedValue([payment]);

      const result = await service.recordPayment({
        orderId,
        amount: 100,
        reference: 'REF-1',
      });

      expect(result).toMatchObject({
        id: '507f1f77bcf86cd799439012',
        order: orderId,
        amount: 100,
        status: PaymentStatus.PENDING,
        reference: 'REF-1',
      });
    });
  });
});
