import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BranchCartDocument = BranchCart & Document;

@Schema({ collection: 'branch_carts', timestamps: true })
export class BranchCart {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Branch', index: true })
  branch?: Types.ObjectId | null;

  @Prop({ default: 0 })
  totalAmount: number;

  createdAt: Date;
  updatedAt: Date;
}

export const BranchCartSchema = SchemaFactory.createForClass(BranchCart);
