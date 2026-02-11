import { NotFoundException } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { createMongooseModelMock } from '../../test/mongoose-model-mock';

jest.mock('../tenants/schemas/tenant.schema', () => ({
  Tenant: class Tenant {},
}));

const mockStorageService = {
  upload: jest.fn().mockResolvedValue({ key: 'invoices/inv-123.pdf' }),
  getSignedUrl: jest.fn().mockResolvedValue('https://example.com/invoice.pdf'),
};

const mockEvents = { emit: jest.fn() };

describe('InvoicesService', () => {
  let invoiceModel: ReturnType<typeof createMongooseModelMock>;
  let orderModel: ReturnType<typeof createMongooseModelMock>;
  let service: InvoicesService;

  beforeEach(() => {
    invoiceModel = createMongooseModelMock();
    orderModel = createMongooseModelMock();
    service = new InvoicesService(
      invoiceModel as never,
      orderModel as never,
      mockStorageService as never,
      mockEvents as never,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createInvoice', () => {
    it('throw NotFoundException when order is missing', async () => {
      orderModel.mockFindByIdResult(null);

      await expect(
        service.createInvoice('missing-order'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('generates invoice and uploads to storage', async () => {
      const orderId = '507f1f77bcf86cd799439011';
      const order = {
        _id: { toString: () => orderId },
        total: 150,
        branch: { code: 'B1', name: 'Filial' },
        items: [
          {
            product: { name: 'P1', code: 'C1' },
            quantity: 2,
            unitPrice: 75,
            lineTotal: 150,
          },
        ],
      };
      const persistedInvoice = {
        _id: { toString: () => '507f1f77bcf86cd799439013' },
        toString: () => '507f1f77bcf86cd799439013',
        invoiceNumber: 'INV-001',
        total: 150,
        issuedAt: new Date(),
      };
      orderModel.mockFindByIdResult(order);
      invoiceModel.create.mockResolvedValue([persistedInvoice]);

      const result = await service.createInvoice(orderId);

      expect(result).toMatchObject({
        id: '507f1f77bcf86cd799439013',
        order: orderId,
      });
      expect(mockStorageService.upload).toHaveBeenCalled();
    });
  });
});
