import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { UserRole } from '../../../common/constants/roles.enum';

export type UserDocument = User & Document;

@Schema({ collection: 'users', timestamps: true, id: true })
export class User {
  _id: Types.ObjectId;
  id?: string; // Mongoose virtual: _id.toString()

  @Prop({
    required: true,
    unique: true,
    index: true,
    lowercase: true,
    trim: true,
  })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({
    type: String,
    enum: Object.values(UserRole),
    default: UserRole.USER,
    index: true,
  })
  role: UserRole;

  @Prop({ type: String })
  firstName?: string | null;

  @Prop({ type: String })
  lastName?: string | null;

  @Prop({ type: String })
  phone?: string | null;

  @Prop({ type: Boolean, default: true, index: true })
  isActive: boolean;

  @Prop({ type: Boolean, default: false })
  twoFactorEnabled: boolean;

  @Prop({ type: String })
  twoFactorSecret?: string | null;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', index: true })
  tenant?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Branch', index: true })
  branch?: Types.ObjectId | null;

  @Prop({ type: Date })
  lastLoginAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
