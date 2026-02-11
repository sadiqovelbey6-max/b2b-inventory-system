import { ConfigService } from '@nestjs/config';
import { MongooseModuleOptions } from '@nestjs/mongoose';

export function getMongoConfig(): MongooseModuleOptions {
  const uri =
    process.env.MONGODB_URI ?? 'mongodb://localhost:27017/b2b_inventory';
  return {
    uri,
    retryAttempts: 5,
    retryDelay: 3000,
    connectTimeoutMS: 10000,
  };
}
