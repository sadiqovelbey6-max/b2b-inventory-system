import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RegistrationConfigDocument = RegistrationConfig & Document;

@Schema({ collection: 'registration_config', timestamps: false })
export class RegistrationConfig {
  _id: Types.ObjectId;

  @Prop({ default: 50 })
  maxUsers: number;

  @Prop({ default: true })
  allowOpenRegistration: boolean;
}

export const RegistrationConfigSchema =
  SchemaFactory.createForClass(RegistrationConfig);
