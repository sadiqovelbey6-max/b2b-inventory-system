import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { TransactionType } from '../../../common/constants/transaction-type.enum';
import { TransactionStatus } from '../../../common/constants/transaction-status.enum';

export type TransactionDocument = Transaction & Document;

@Schema({ collection: 'transactions', timestamps: false })
export class Transaction {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  product: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Branch', index: true })
  branch?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Order', index: true })
  order?: Types.ObjectId | null;

  @Prop({ type: String, enum: TransactionType, required: true })
  type: TransactionType;

  @Prop({ required: true })
  quantity: number;

  @Prop({
    type: String,
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  @Prop({ type: Number })
  calculatedStockAfter?: number | null;

  @Prop({ type: String })
  notes?: string | null;

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);
