import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type InvoiceDocument = Invoice & Document;

@Schema({ collection: 'invoices', timestamps: true })
export class Invoice {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Order', required: true, index: true })
  order: Types.ObjectId;

  @Prop({ required: true, unique: true, index: true })
  invoiceNumber: string;

  @Prop({ default: 0 })
  total: number;

  @Prop()
  pdfUrl?: string;

  @Prop({ type: Date })
  issuedAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export const InvoiceSchema = SchemaFactory.createForClass(Invoice);
