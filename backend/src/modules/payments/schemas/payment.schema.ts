import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { PaymentStatus } from '../../../common/constants/payment-status.enum';

export type PaymentDocument = Payment & Document;

@Schema({ collection: 'payments', timestamps: true })
export class Payment {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Order', required: true, index: true })
  order: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Invoice', index: true })
  invoice?: Types.ObjectId | null;

  @Prop({ default: 0 })
  amount: number;

  @Prop({ type: String, enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Prop({ default: 'manual_bank' })
  method: string;

  @Prop()
  reference?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
