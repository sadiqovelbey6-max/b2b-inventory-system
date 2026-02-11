import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProductDocument = Product & Document;

@Schema({ collection: 'products', timestamps: true })
export class Product {
  _id: Types.ObjectId;

  @Prop({
    required: true,
    unique: true,
    index: true,
    uppercase: true,
    trim: true,
    maxlength: 64,
  })
  code: string;

  @Prop({ required: true, index: true })
  name: string;

  @Prop({ type: String })
  description?: string;

  @Prop({ type: String })
  imageUrl?: string;

  @Prop({ type: String, index: true })
  category?: string;

  @Prop({ type: String })
  barcode?: string;

  @Prop({ type: String })
  unit?: string;

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  price: number;

  @Prop({ type: Number, default: 0, min: 0 })
  purchasePrice?: number;

  @Prop({ type: Types.ObjectId, ref: 'Branch', index: true })
  branch?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', index: true })
  tenant?: Types.ObjectId | null;

  createdAt: Date;
  updatedAt: Date;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

// Pre-save hook for code normalization
ProductSchema.pre('save', function (next) {
  if (this.isModified('code')) {
    this.code = this.code.trim().toUpperCase();
  }
  next();
});
