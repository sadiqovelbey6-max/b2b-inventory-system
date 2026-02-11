import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { OrderStatus } from '../../../common/constants/order-status.enum';

export type OrderDocument = Order & Document;

@Schema({ collection: 'orders', timestamps: true })
export class Order {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Branch', index: true })
  branch?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  createdBy: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(OrderStatus),
    default: OrderStatus.DRAFT,
    index: true,
  })
  status: OrderStatus;

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  subtotal: number;

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  total: number;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'OrderItem' }], default: [] })
  items: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Invoice' }], default: [] })
  invoices: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Payment' }], default: [] })
  payments: Types.ObjectId[];

  @Prop({ type: Date })
  confirmedAt?: Date | null;

  @Prop({ type: Date })
  deliveredAt?: Date | null;

  @Prop({ type: Date })
  approvedAt?: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  approvedBy?: Types.ObjectId | null;

  @Prop({ type: Date })
  rejectedAt?: Date | null;

  @Prop({ type: String })
  rejectionReason?: string | null;

  @Prop({ type: Date })
  shippedAt?: Date | null;

  @Prop({ type: Array, default: [] })
  stockShortageItems?: Array<{
    productCode: string;
    productName: string;
    requestedQty: number;
    availableQty: number;
    shortageQty: number;
  }> | null;

  createdAt: Date;
  updatedAt: Date;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ approvedAt: 1 });
OrderSchema.index({ deliveredAt: 1 });
