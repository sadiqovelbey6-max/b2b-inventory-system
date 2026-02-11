import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AuditLogDocument = AuditLog & Document;

@Schema({ collection: 'audit_logs', timestamps: false })
export class AuditLog {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  actor?: Types.ObjectId | null;

  @Prop({ required: true })
  action: string;

  @Prop()
  entity?: string;

  @Prop()
  entityId?: string;

  @Prop({ type: Object })
  before?: Record<string, unknown>;

  @Prop({ type: Object })
  after?: Record<string, unknown>;

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
AuditLogSchema.index({ createdAt: -1 });
