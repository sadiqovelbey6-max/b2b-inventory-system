import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BranchDocument = Branch & Document;

@Schema({ collection: 'branches', timestamps: true })
export class Branch {
  _id: Types.ObjectId;

  @Prop({ required: true, unique: true, index: true })
  code: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  address?: string;

  @Prop()
  phone?: string;

  @Prop()
  email?: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', index: true })
  tenant?: Types.ObjectId | null;

  createdAt: Date;
  updatedAt: Date;
}

export const BranchSchema = SchemaFactory.createForClass(Branch);
