import {
  BadRequestException,
  Injectable,
  StreamableFile,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { parse } from 'csv-parse/sync';
import { Readable, PassThrough } from 'stream';
import PDFDocument from 'pdfkit';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import {
  Inventory,
  InventoryDocument,
} from '../inventory/schemas/inventory.schema';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Invoice, InvoiceDocument } from '../invoices/schemas/invoice.schema';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';
import { StorageService } from '../storage/storage.service';

type ImportSummary = {
  processed: number;
  created: number;
  updated: number;
  errors: string[];
};

function toId(d: unknown): string | null {
  const doc = d as { _id?: Types.ObjectId } | null | undefined;
  return doc?._id?.toString() ?? null;
}

@Injectable()
export class ImportExportService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(Inventory.name)
    private readonly inventoryModel: Model<InventoryDocument>,
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Invoice.name)
    private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    private readonly storageService: StorageService,
  ) {}

  async importProducts(file: { buffer?: Buffer }): Promise<ImportSummary> {
    const buffer = this.ensureBuffer(file, 'Məhsul importu üçün fayl oxunmadı');
    const rows = this.parseCsv(buffer, 'products');
    const seenCodes = new Set<string>();
    const summary: ImportSummary = {
      processed: rows.length,
      created: 0,
      updated: 0,
      errors: [],
    };

    for (let index = 0; index < rows.length; index += 1) {
      const record = rows[index];
      const rowLabel = `Sətir ${index + 2}`;
      const rawCode = this.getOptionalStringField(record, [
        'code',
        'Code',
        'CODE',
      ]);
      const name =
        this.getOptionalStringField(record, ['name', 'Name', 'NAME']) ?? '';
      const code = rawCode ? rawCode.toUpperCase() : '';

      if (!code) {
        summary.errors.push(`${rowLabel}: 'code' sahəsi tələb olunur`);
        continue;
      }
      if (!this.isValidProductCode(code)) {
        summary.errors.push(
          `${rowLabel}: 'code' yalnız latın hərfləri, rəqəmlər, '-' və '_' simvollarından ibarət olmalıdır`,
        );
        continue;
      }
      if (seenCodes.has(code)) {
        summary.errors.push(
          `${rowLabel}: '${code}' kodu eyni fayl daxilində təkrarlanır`,
        );
        continue;
      }
      seenCodes.add(code);

      if (!name) {
        summary.errors.push(`${rowLabel}: 'name' sahəsi tələb olunur`);
        continue;
      }

      try {
        const product = await this.productModel.findOne({ code }).exec();

        const priceRaw =
          this.getRawValue(record, [
            'price',
            'Price',
            'PRICE',
            'unit_price',
            'unitPrice',
          ]) ?? '';
        let price: number | undefined;
        if (priceRaw !== undefined && priceRaw !== '') {
          const formatted = this.stringifyValue(priceRaw);
          const parsed = Number.parseFloat(formatted.replace(',', '.'));
          if (Number.isNaN(parsed)) {
            summary.errors.push(
              `${rowLabel}: 'price' dəyəri nömrə olmalıdır (verilən: ${formatted})`,
            );
            continue;
          }
          if (parsed < 0) {
            summary.errors.push(
              `${rowLabel}: 'price' dəyəri mənfi ola bilməz (verilən: ${formatted})`,
            );
            continue;
          }
          price = parsed;
        }

        const desc = this.getOptionalStringField(record, [
          'description',
          'Description',
        ]);
        const cat = this.getOptionalStringField(record, [
          'category',
          'Category',
        ]);
        const img = this.getOptionalStringField(record, [
          'imageUrl',
          'image_url',
          'ImageUrl',
        ]);
        const bar = this.getOptionalStringField(record, ['barcode', 'Barcode']);
        const un = this.getOptionalStringField(record, ['unit', 'Unit']);

        const updateData: Record<string, unknown> = { name };
        if (desc !== undefined) updateData.description = desc;
        if (cat !== undefined) updateData.category = cat;
        if (img !== undefined) updateData.imageUrl = img;
        if (bar !== undefined) updateData.barcode = bar;
        if (un !== undefined) updateData.unit = un;
        if (price !== undefined) updateData.price = price;

        if (!product) {
          await this.productModel.create({ code, ...updateData });
          summary.created += 1;
        } else {
          await this.productModel
            .updateOne({ _id: product._id }, { $set: updateData })
            .exec();
          summary.updated += 1;
        }
      } catch (error) {
        summary.errors.push(
          `${rowLabel}: Xəta baş verdi (${(error as Error).message})`,
        );
      }
    }

    return summary;
  }

  async importInventory(file: { buffer?: Buffer }): Promise<ImportSummary> {
    const buffer = this.ensureBuffer(
      file,
      'İnventar importu üçün fayl oxunmadı',
    );
    const rows = this.parseCsv(buffer, 'inventory');
    const processedPairs = new Set<string>();
    const summary: ImportSummary = {
      processed: rows.length,
      created: 0,
      updated: 0,
      errors: [],
    };

    const branchCache = new Map<string, { _id: Types.ObjectId }>();
    const productCache = new Map<string, { _id: Types.ObjectId }>();

    const loadBranch = async (branchCode: string) => {
      const normalized = branchCode.toUpperCase();
      if (branchCache.has(normalized)) {
        return branchCache.get(normalized) ?? null;
      }
      const branch = await this.branchModel
        .findOne({ code: normalized })
        .exec();
      if (branch) {
        branchCache.set(normalized, { _id: branch._id });
        return { _id: branch._id };
      }
      return null;
    };

    const loadProduct = async (productCode: string) => {
      const normalized = productCode.toUpperCase();
      if (productCache.has(normalized)) {
        return productCache.get(normalized) ?? null;
      }
      const product = await this.productModel
        .findOne({ code: normalized })
        .exec();
      if (product) {
        productCache.set(normalized, { _id: product._id });
        return { _id: product._id };
      }
      return null;
    };

    for (let index = 0; index < rows.length; index += 1) {
      const record = rows[index];
      const rowLabel = `Sətir ${index + 2}`;
      const branchCode =
        this.getOptionalStringField(record, [
          'branch_code',
          'branchCode',
          'BranchCode',
          'Branch_Code',
        ]) ?? '';
      const productCode =
        this.getOptionalStringField(record, [
          'product_code',
          'productCode',
          'ProductCode',
          'Product_Code',
        ]) ?? '';

      if (!branchCode) {
        summary.errors.push(`${rowLabel}: 'branch_code' tələb olunur`);
        continue;
      }
      if (!this.isValidBranchCode(branchCode)) {
        summary.errors.push(
          `${rowLabel}: 'branch_code' yalnız latın hərfləri, rəqəmlər, '-' və '_' simvollarından ibarət olmalıdır`,
        );
        continue;
      }
      if (!productCode) {
        summary.errors.push(`${rowLabel}: 'product_code' tələb olunur`);
        continue;
      }
      if (!this.isValidProductCode(productCode)) {
        summary.errors.push(
          `${rowLabel}: 'product_code' yalnız latın hərfləri, rəqəmlər, '-' və '_' simvollarından ibarət olmalıdır`,
        );
        continue;
      }

      const normalizedBranchCode = String(branchCode).trim().toUpperCase();
      const normalizedProductCode = String(productCode).trim().toUpperCase();
      const combinationKey = `${normalizedBranchCode}:${normalizedProductCode}`;
      if (processedPairs.has(combinationKey)) {
        summary.errors.push(
          `${rowLabel}: '${branchCode}' filialı ilə '${productCode}' məhsulu faylda təkrarlanır`,
        );
        continue;
      }
      processedPairs.add(combinationKey);

      const branch = await loadBranch(normalizedBranchCode);
      if (!branch) {
        summary.errors.push(
          `${rowLabel}: '${branchCode}' kodu ilə filial tapılmadı`,
        );
        continue;
      }

      const product = await loadProduct(normalizedProductCode);
      if (!product) {
        summary.errors.push(
          `${rowLabel}: '${productCode}' kodu ilə məhsul tapılmadı`,
        );
        continue;
      }

      const availableQty = this.parseIntegerField(
        this.getRawValue(record, [
          'available_qty',
          'availableQty',
          'AvailableQty',
        ]) ?? 0,
        `${rowLabel}: 'available_qty'`,
        summary,
      );
      const inTransitQty = this.parseIntegerField(
        this.getRawValue(record, [
          'in_transit_qty',
          'inTransitQty',
          'InTransitQty',
        ]) ?? 0,
        `${rowLabel}: 'in_transit_qty'`,
        summary,
      );
      const reservedQty = this.parseIntegerField(
        this.getRawValue(record, [
          'reserved_qty',
          'reservedQty',
          'ReservedQty',
        ]) ?? 0,
        `${rowLabel}: 'reserved_qty'`,
        summary,
      );
      if (
        availableQty === undefined ||
        inTransitQty === undefined ||
        reservedQty === undefined
      ) {
        continue;
      }

      try {
        const inventory = await this.inventoryModel
          .findOne({ branch: branch._id, product: product._id })
          .exec();
        if (!inventory) {
          await this.inventoryModel.create({
            branch: branch._id,
            product: product._id,
            availableQty,
            inTransitQty,
            reservedQty,
            calculatedQty: availableQty,
          });
          summary.created += 1;
        } else {
          await this.inventoryModel
            .updateOne(
              { _id: inventory._id },
              { $set: { availableQty, inTransitQty, reservedQty } },
            )
            .exec();
          summary.updated += 1;
        }
      } catch (error) {
        summary.errors.push(
          `${rowLabel}: İnventar saxlanarkən xəta (${(error as Error).message})`,
        );
      }
    }

    return summary;
  }

  async exportCsv(resource: 'orders' | 'invoices' | 'payments') {
    const { headers, rows } = await this.gatherExportData(resource);
    const csvContent = this.stringifyCsv(headers, rows);
    return new StreamableFile(Readable.from([csvContent]));
  }

  async exportPdf(resource: 'orders' | 'invoices' | 'payments') {
    const { headers, rows, title } = await this.gatherExportData(resource);
    const doc = new PDFDocument({ margin: 32 });
    doc.fontSize(18).text(`${title} hesabatı`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(10);
    doc.fillColor('#111111');
    doc.text(headers.join(' | '));
    doc.moveDown();
    doc.fillColor('#333333');
    rows.forEach((row) => {
      doc.text(row.join(' | '));
      doc.moveDown(0.5);
    });
    doc.moveDown();
    doc.fillColor('#111111');
    doc.text(`Yaradılma tarixi: ${new Date().toLocaleString('az-AZ')}`);
    const stream = new PassThrough();
    doc.pipe(stream);
    doc.end();
    return new StreamableFile(stream);
  }

  private ensureBuffer(file: { buffer?: Buffer }, message: string) {
    if (file?.buffer && Buffer.isBuffer(file.buffer)) return file.buffer;
    throw new BadRequestException(message);
  }

  private parseCsv(buffer: Buffer, context: string): Record<string, unknown>[] {
    try {
      return parse(buffer.toString('utf-8'), {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch (error) {
      throw new BadRequestException(
        `${context} CSV faylını oxumaq mümkün olmadı: ${(error as Error).message}`,
      );
    }
  }

  private parseIntegerField(
    value: unknown,
    label: string,
    summary: ImportSummary,
  ): number | undefined {
    const rawValue = this.stringifyValue(value);
    const normalized = rawValue === '' ? 0 : Number.parseInt(rawValue, 10);
    if (!Number.isFinite(normalized)) {
      summary.errors.push(
        `${label} tam ədəd olmalıdır (verilən: ${this.stringifyValue(value)})`,
      );
      return undefined;
    }
    if (normalized < 0) {
      summary.errors.push(
        `${label} mənfi ola bilməz (verilən: ${this.stringifyValue(value)})`,
      );
      return undefined;
    }
    return normalized;
  }

  private stringifyCsv(headers: string[], rows: string[][]) {
    const escapeValue = (value: string) => {
      if (value.includes('"') || value.includes(',') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };
    const headerRow = headers.map(escapeValue).join(',');
    const dataRows = rows.map((row) =>
      row.map((value) => escapeValue(value ?? '')).join(','),
    );
    return [headerRow, ...dataRows].join('\n');
  }

  private async gatherExportData(resource: 'orders' | 'invoices' | 'payments') {
    switch (resource) {
      case 'orders':
        return this.exportOrdersData();
      case 'invoices':
        return this.exportInvoicesData();
      case 'payments':
        return this.exportPaymentsData();
      default:
        throw new BadRequestException('Dəstəklənməyən export resursu');
    }
  }

  private async exportOrdersData() {
    const orders = await this.orderModel
      .find()
      .populate('branch')
      .populate('createdBy')
      .populate({ path: 'items', populate: { path: 'product' } })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const headers = [
      'Order ID',
      'Filial kodu',
      'Filial adı',
      'Status',
      'İstifadəçi',
      'Məbləğ',
      'Məhsul sayı',
      'Yaradıldı',
      'Təsdiqləndi',
    ];

    const rows = orders.map((o: Record<string, unknown>) => {
      const items = (o.items ?? []) as Array<{ quantity?: number }>;
      const totalQty = items.reduce(
        (acc, item) => acc + (item.quantity ?? 0),
        0,
      );
      const branch = o.branch as
        | { code?: string; name?: string }
        | null
        | undefined;
      const createdBy = o.createdBy as { email?: string } | null | undefined;
      return [
        toId(o._id) ?? '',
        branch?.code ?? '',
        branch?.name ?? '',
        String(o.status ?? ''),
        createdBy?.email ?? '',
        Number(o.total ?? 0).toFixed(2),
        String(totalQty),
        (o.createdAt as Date)?.toISOString?.() ?? '',
        (o.confirmedAt as Date)?.toISOString?.() ?? '',
      ];
    });

    return { headers, rows, title: 'Sifarişlər' };
  }

  private async exportInvoicesData() {
    const invoices = await this.invoiceModel
      .find()
      .populate({
        path: 'order',
        populate: [{ path: 'branch' }, { path: 'createdBy' }],
      })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const headers = [
      'Qaimə ID',
      'Qaimə nömrəsi',
      'Sifariş ID',
      'Filial',
      'Məbləğ',
      'Verilmə tarixi',
      'PDF URL',
      'Yaradıldı',
    ];

    const rows = await Promise.all(
      (invoices as Record<string, unknown>[]).map(async (inv) => {
        const order = inv.order as
          | { _id?: Types.ObjectId; branch?: { name?: string } }
          | null
          | undefined;
        return [
          toId(inv._id) ?? '',
          String(inv.invoiceNumber ?? ''),
          order ? (toId(order._id) ?? '') : '',
          order?.branch?.name ?? '',
          Number(inv.total ?? 0).toFixed(2),
          (inv.issuedAt as Date)?.toISOString?.() ?? '',
          await this.resolveInvoicePdfUrl(inv.pdfUrl as string | null),
          (inv.createdAt as Date)?.toISOString?.() ?? '',
        ];
      }),
    );

    return { headers, rows, title: 'Qaimələr' };
  }

  private async exportPaymentsData() {
    const payments = await this.paymentModel
      .find()
      .populate({ path: 'order', populate: { path: 'branch' } })
      .populate('invoice')
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const headers = [
      'Ödəniş ID',
      'Sifariş ID',
      'Filial',
      'Invoice ID',
      'Məbləğ',
      'Status',
      'Metod',
      'Reference',
      'Yaradıldı',
    ];

    const rows = (payments as Record<string, unknown>[]).map((p) => {
      const order = p.order as
        | { _id?: Types.ObjectId; branch?: { name?: string } }
        | null
        | undefined;
      const invoice = p.invoice as { _id?: Types.ObjectId } | null | undefined;
      return [
        toId(p._id) ?? '',
        order ? (toId(order._id) ?? '') : '',
        order?.branch?.name ?? '',
        invoice ? (toId(invoice._id) ?? '') : '',
        Number(p.amount ?? 0).toFixed(2),
        String(p.status ?? ''),
        String(p.method ?? ''),
        String(p.reference ?? ''),
        (p.createdAt as Date)?.toISOString?.() ?? '',
      ];
    });

    return { headers, rows, title: 'Ödənişlər' };
  }

  private getOptionalStringField(
    row: Record<string, unknown>,
    keys: string[],
  ): string | undefined {
    const value = this.getRawValue(row, keys);
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'object') return undefined;
    const str = this.stringifyValue(value).trim();
    return str ? str : undefined;
  }

  private getRawValue(row: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(row, key)) return row[key];
    }
    return undefined;
  }

  private stringifyValue(value: unknown) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean')
      return `${value}`;
    if (value instanceof Date) return value.toISOString();
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }

  private isValidProductCode(code: string) {
    return /^[A-Za-z0-9_-]{2,64}$/.test(code);
  }

  private isValidBranchCode(code: string) {
    return /^[A-Za-z0-9_-]{2,64}$/.test(code);
  }

  private async resolveInvoicePdfUrl(pdfUrl?: string | null) {
    if (!pdfUrl) return '';
    if (pdfUrl.startsWith('http://') || pdfUrl.startsWith('https://'))
      return pdfUrl;
    if (pdfUrl.startsWith('/')) return pdfUrl;
    try {
      return await this.storageService.getSignedUrl(pdfUrl);
    } catch {
      return pdfUrl;
    }
  }
}
