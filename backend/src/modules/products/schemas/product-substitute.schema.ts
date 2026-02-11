import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProductSubstituteDocument = ProductSubstitute & Document;

@Schema({ collection: 'product_substitutes', timestamps: true })
export class ProductSubstitute {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  product: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  substitute: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

export const ProductSubstituteSchema =
  SchemaFactory.createForClass(ProductSubstitute);
ProductSubstituteSchema.index({ product: 1, substitute: 1 }, { unique: true });
