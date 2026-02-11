import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Payment, PaymentDocument } from './schemas/payment.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Invoice, InvoiceDocument } from '../invoices/schemas/invoice.schema';
import { PaymentStatus } from '../../common/constants/payment-status.enum';

interface CreatePaymentInput {
  orderId: string;
  invoiceId?: string;
  amount: number;
  status?: PaymentStatus;
  method?: string;
  reference?: string;
}

function toId(d: { _id?: Types.ObjectId } | null | undefined): string | null {
  return d?._id?.toString() ?? null;
}

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Invoice.name)
    private readonly invoiceModel: Model<InvoiceDocument>,
  ) {}

  async recordPayment(payload: CreatePaymentInput) {
    const order = await this.orderModel.findById(payload.orderId).exec();
    if (!order) {
      throw new NotFoundException('Sifariş tapılmadı');
    }

    let invoiceId: Types.ObjectId | null = null;
    if (payload.invoiceId) {
      const invoice = await this.invoiceModel
        .findById(payload.invoiceId)
        .exec();
      if (!invoice) {
        throw new BadRequestException('Qaimə tapılmadı');
      }
      invoiceId = invoice._id;
    }

    const [payment] = await this.paymentModel.create([
      {
        order: new Types.ObjectId(payload.orderId),
        invoice: invoiceId ?? undefined,
        amount: payload.amount,
        status: payload.status ?? PaymentStatus.PENDING,
        method: payload.method ?? 'manual_bank',
        reference: payload.reference,
      },
    ]);

    return {
      id: toId(payment),
      order: payload.orderId,
      invoice: payload.invoiceId ?? null,
      amount: payment.amount,
      status: payment.status,
      method: payment.method,
      reference: payment.reference,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }
}
