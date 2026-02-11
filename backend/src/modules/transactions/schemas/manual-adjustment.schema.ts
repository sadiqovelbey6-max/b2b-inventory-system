import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ManualAdjustmentStatus } from '../../../common/constants/manual-adjustment-status.enum';

export type ManualAdjustmentDocument = ManualAdjustment & Document;

@Schema({ collection: 'manual_adjustments_log', timestamps: false })
export class ManualAdjustment {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  product: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Branch', index: true })
  branch?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  createdBy: Types.ObjectId;

  @Prop({ required: true })
  quantityChange: number;

  @Prop({ required: true })
  stockBefore: number;

  @Prop({ required: true })
  stockAfter: number;

  @Prop({
    type: String,
    enum: ManualAdjustmentStatus,
    default: ManualAdjustmentStatus.PENDING,
  })
  status: ManualAdjustmentStatus;

  @Prop({ type: String })
  notes?: string | null;

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const ManualAdjustmentSchema =
  SchemaFactory.createForClass(ManualAdjustment);
