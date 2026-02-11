import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type OrderItemDocument = OrderItem & Document;

@Schema({ collection: 'order_items', timestamps: true })
export class OrderItem {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Order', required: true, index: true })
  order: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  product: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 0 })
  quantity: number;

  @Prop({ type: Number, required: true, min: 0 })
  unitPrice: number;

  @Prop({ type: Number, required: true, min: 0 })
  lineTotal: number;

  createdAt: Date;
  updatedAt: Date;
}

export const OrderItemSchema = SchemaFactory.createForClass(OrderItem);
OrderItemSchema.index({ order: 1, product: 1 });
