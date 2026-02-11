import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CartItemDocument = CartItem & Document;

@Schema({ collection: 'cart_items', timestamps: false })
export class CartItem {
  _id: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'BranchCart',
    required: true,
    index: true,
  })
  cart: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  product: Types.ObjectId;

  @Prop({ default: 0 })
  quantity: number;

  @Prop({ default: 0 })
  unitPrice: number;

  @Prop({ default: 0 })
  lineTotal: number;
}

export const CartItemSchema = SchemaFactory.createForClass(CartItem);
