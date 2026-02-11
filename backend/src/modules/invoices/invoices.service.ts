import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Invoice, InvoiceDocument } from './schemas/invoice.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import PDFDocument from 'pdfkit';
import { StorageService } from '../storage/storage.service';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

type OrderLike = {
  _id?: Types.ObjectId;
  id?: string;
  total?: number;
  branch?: { code?: string; name?: string } | null;
  items?: Array<{
    product?: { name?: string; code?: string };
    quantity?: number;
    unitPrice?: number;
    lineTotal?: number;
  }>;
};

function toId(
  d: { _id?: Types.ObjectId } | Types.ObjectId | null | undefined,
): string | null {
  if (!d) return null;
  if (typeof (d as Types.ObjectId).toString === 'function')
    return (d as Types.ObjectId).toString();
  return (d as { _id?: Types.ObjectId })?._id?.toString() ?? null;
}

@Injectable()
export class InvoicesService implements OnModuleInit {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    @InjectModel(Invoice.name)
    private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    private readonly storageService: StorageService,
    private readonly events: EventEmitter2,
  ) {}

  onModuleInit() {
    // Event listener qeydiyyatı
  }

  @OnEvent('order.delivered')
  async handleOrderDelivered(payload: { orderId: string }) {
    try {
      await this.createInvoice(payload.orderId);
    } catch (error) {
      this.logger.error(
        'Qaimə yaradılarkən xəta (event listener)',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async createInvoice(orderId: string) {
    const order = await this.orderModel
      .findById(orderId)
      .populate('items')
      .populate({ path: 'items', populate: { path: 'product' } })
      .populate('branch')
      .lean()
      .exec();

    if (!order) {
      throw new NotFoundException('Sifariş tapılmadı');
    }

    const invoiceNumber = this.buildInvoiceNumber();
    const orderObj = order as unknown as OrderLike;

    const [persistedInvoice] = await this.invoiceModel.create([
      {
        order: new Types.ObjectId(orderId),
        invoiceNumber,
        total: Number(orderObj.total ?? 0),
        issuedAt: new Date(),
      },
    ]);

    const pdfBuffer = await this.renderInvoicePdf(orderObj, invoiceNumber);

    const storageKey = this.buildStorageKey(orderObj, invoiceNumber);
    const uploadResult = await this.storageService.upload(
      {
        buffer: pdfBuffer,
        key: storageKey,
        contentType: 'application/pdf',
        acl: 'private',
        originalName: `${invoiceNumber}.pdf`,
      },
      {
        allowedMimeTypes: ['application/pdf'],
        maxSizeBytes: 10 * 1024 * 1024,
      },
    );

    await this.invoiceModel
      .updateOne(
        { _id: persistedInvoice._id },
        { $set: { pdfUrl: uploadResult.key } },
      )
      .exec();

    const downloadUrl = await this.toPublicPdfUrl(uploadResult.key);

    return {
      id: toId(persistedInvoice),
      order: orderId,
      invoiceNumber,
      total: persistedInvoice.total,
      pdfUrl: downloadUrl,
      issuedAt: persistedInvoice.issuedAt,
    };
  }

  private buildInvoiceNumber() {
    return `INV-${new Date().getFullYear()}-${Math.floor(Math.random() * 100000)
      .toString()
      .padStart(5, '0')}`;
  }

  private buildStorageKey(order: OrderLike, invoiceNumber: string) {
    const branchCode = order.branch?.code?.toUpperCase?.();
    const safeBranch = branchCode?.replace(/[^\w-]/g, '') || 'general';
    return `invoices/${safeBranch}/${invoiceNumber}.pdf`;
  }

  private async toPublicPdfUrl(pdfPath?: string) {
    if (!pdfPath) return '';
    if (pdfPath.startsWith('http://') || pdfPath.startsWith('https://'))
      return pdfPath;
    if (pdfPath.startsWith('/')) return pdfPath;
    return this.storageService.getSignedUrl(pdfPath, 24 * 60 * 60);
  }

  private async renderInvoicePdf(order: OrderLike, invoiceNumber: string) {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 32 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('error', (error) =>
        reject(error instanceof Error ? error : new Error(String(error))),
      );
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      doc.fontSize(20).text('Qaimə', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Qaimə nömrəsi: ${invoiceNumber}`);
      doc.text(`Sifariş ID: ${toId(order._id ?? order) ?? order.id ?? ''}`);
      if (order.branch?.name) doc.text(`Filial: ${order.branch.name}`);
      doc.text(`Tarix: ${new Date().toLocaleDateString('az-AZ')}`);
      doc.moveDown();

      doc.text('Məhsullar:', { underline: true });

      (order.items ?? []).forEach((item) => {
        const productName =
          item.product?.name ?? item.product?.code ?? 'Məhsul';
        const quantity = Number(item.quantity ?? 0);
        const unitPrice = Number(item.unitPrice ?? 0);
        const lineTotal = Number(item.lineTotal ?? quantity * unitPrice);
        doc
          .text(
            `${productName} (${quantity} x ${unitPrice.toFixed(2)} AZN) = ${lineTotal.toFixed(2)} AZN`,
          )
          .moveDown(0.2);
      });

      doc.moveDown();
      doc.fontSize(14).text(`Cəm: ${Number(order.total ?? 0).toFixed(2)} AZN`, {
        align: 'right',
      });
      doc.end();
    });
  }
}
