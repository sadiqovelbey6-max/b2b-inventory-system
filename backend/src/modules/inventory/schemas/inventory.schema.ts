import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type InventoryDocument = Inventory & Document;

@Schema({ collection: 'inventories', timestamps: false })
export class Inventory {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Branch', index: true })
  branch?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  product: Types.ObjectId;

  @Prop({ default: 0 })
  availableQty: number;

  @Prop({ default: 0 })
  calculatedQty: number;

  @Prop({ default: 0 })
  inTransitQty: number;

  @Prop({ default: 0 })
  reservedQty: number;

  @Prop({ type: Date })
  lastPublishedAt?: Date | null;
}

export const InventorySchema = SchemaFactory.createForClass(Inventory);
InventorySchema.index({ branch: 1, product: 1 }, { unique: true });
