import { ImportExportService } from './import-export.service';
import { createMongooseModelMock } from '../../test/mongoose-model-mock';

jest.mock('../tenants/schemas/tenant.schema', () => ({
  Tenant: class Tenant {},
}));

const createStubService = () => {
  const productModel = createMongooseModelMock();
  const inventoryModel = createMongooseModelMock();
  const branchModel = createMongooseModelMock();
  const orderModel = createMongooseModelMock();
  const invoiceModel = createMongooseModelMock();
  const paymentModel = createMongooseModelMock();
  const storageService = {
    getSignedUrl: jest
      .fn()
      .mockResolvedValue('https://example.com/invoice.pdf'),
  };

  const service = new ImportExportService(
    productModel as never,
    inventoryModel as never,
    branchModel as never,
    orderModel as never,
    invoiceModel as never,
    paymentModel as never,
    storageService as never,
  );

  return { service, productModel, inventoryModel, branchModel };
};

describe('ImportExportService.importProducts', () => {
  it('yeni məhsulu yaradır', async () => {
    const { service, productModel } = createStubService();
    productModel.mockFindOneResult(null);
    productModel.create.mockResolvedValue({
      code: 'PRD001',
      name: 'Demo',
    });

    const csv = 'code,name,price\nPRD001,Demo,12.5';
    const summary = await service.importProducts({ buffer: Buffer.from(csv) });

    expect(summary.created).toBe(1);
    expect(summary.updated).toBe(0);
    expect(summary.errors).toHaveLength(0);
    expect(productModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'PRD001', name: 'Demo' }),
    );
  });

  it('mənfi və ya boş qiymətləri rədd edir', async () => {
    const { service, productModel } = createStubService();
    productModel.mockFindOneResult(null);

    const csv = 'code,name,price\nPRD001,Demo,-10';
    const summary = await service.importProducts({ buffer: Buffer.from(csv) });

    expect(summary.created).toBe(0);
    expect(summary.updated).toBe(0);
    expect(summary.errors[0]).toContain('mənfi ola bilməz');
    expect(productModel.create).not.toHaveBeenCalled();
  });

  it('code və name boş olanda xəta qaytarır', async () => {
    const { service } = createStubService();
    const csv = 'code,name\n,No Name\nPRD002,';
    const summary = await service.importProducts({ buffer: Buffer.from(csv) });

    expect(summary.errors).toHaveLength(2);
    expect(summary.created).toBe(0);
    expect(summary.updated).toBe(0);
  });

  it('eyni faylda təkrarlanan kodları xəta kimi qeyd edir', async () => {
    const { service, productModel } = createStubService();
    productModel.mockFindOneResult(null);
    productModel.create.mockResolvedValue({
      code: 'PRD001',
      name: 'Demo',
    });

    const csv = 'code,name\nPRD001,Demo\nPRD001,Another';
    const summary = await service.importProducts({ buffer: Buffer.from(csv) });

    expect(summary.created).toBe(1);
    expect(summary.errors).toHaveLength(1);
    expect(summary.errors[0]).toContain('təkrarlanır');
  });
});

describe('ImportExportService.importInventory', () => {
  it('inventar sətirlərində mənfi sayları qəbul etmir', async () => {
    const { service, branchModel, productModel } = createStubService();
    branchModel.mockFindOneResult({ _id: { toString: () => 'branch-1' } });
    productModel.mockFindOneResult({ _id: { toString: () => 'product-1' } });

    const csv =
      'branch_code,product_code,available_qty,in_transit_qty,reserved_qty\nBAKU,PRD001,-1,0,0';
    const summary = await service.importInventory({ buffer: Buffer.from(csv) });

    expect(summary.errors[0]).toContain('mənfi ola bilməz');
    expect(summary.created).toBe(0);
    expect(summary.updated).toBe(0);
  });

  it('branch və product kodları üçün formatı yoxlayır', async () => {
    const { service } = createStubService();
    const csv =
      'branch_code,product_code,available_qty\nBA KU,PRD001,5\nBAKU,PRD 001,3';

    const summary = await service.importInventory({ buffer: Buffer.from(csv) });

    expect(summary.errors).toHaveLength(2);
    expect(summary.errors[0]).toContain('branch_code');
    expect(summary.errors[1]).toContain('product_code');
  });

  it('təkrarlanan branch/product kombinasiyasını xəta kimi qeyd edir', async () => {
    const { service, branchModel, productModel, inventoryModel } =
      createStubService();
    branchModel.mockFindOneResult({ _id: { toString: () => 'branch-1' } });
    productModel.mockFindOneResult({ _id: { toString: () => 'product-1' } });
    inventoryModel.mockFindOneResult(null);
    inventoryModel.create.mockResolvedValue({});

    const csv =
      'branch_code,product_code,available_qty,in_transit_qty,reserved_qty\nBAKU,PRD001,5,0,0\nBAKU,PRD001,10,0,0';
    const summary = await service.importInventory({ buffer: Buffer.from(csv) });

    expect(summary.created).toBe(1);
    expect(summary.errors).toHaveLength(1);
    expect(summary.errors[0]).toContain('təkrarlanır');
  });
});
