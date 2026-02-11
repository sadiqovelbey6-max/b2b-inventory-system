import * as Joi from 'joi';

export const validationSchema = Joi.object({
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  POSTGRES_HOST: Joi.string().default('postgres'),
  POSTGRES_PORT: Joi.number().default(5432),
  POSTGRES_USER: Joi.string().default('b2b_user'),
  POSTGRES_PASSWORD: Joi.string().default('b2b_pass'),
  POSTGRES_DB: Joi.string().default('b2b_inventory'),
  DB_SYNCHRONIZE: Joi.string().valid('true', 'false').allow(''),
  // MongoDB konfiqurasiyası (hazır, amma hələ istifadə olunmur)
  MONGODB_URI: Joi.string().default('mongodb://localhost:27017/b2b_inventory'),
  JWT_ACCESS_SECRET: Joi.string().required(),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_ACCESS_TTL: Joi.string().default('15m'),
  JWT_REFRESH_TTL: Joi.string().default('7d'),
  CORS_ORIGINS: Joi.string().allow(''),
  STORAGE_DRIVER: Joi.string().valid('local', 's3').default('local'),
  LOCAL_STORAGE_PATH: Joi.string().default('uploads'),
  S3_BUCKET: Joi.string().allow(''),
  S3_REGION: Joi.string().allow(''),
  S3_ENDPOINT: Joi.string().allow(''),
  S3_ACCESS_KEY: Joi.string().allow(''),
  S3_SECRET_KEY: Joi.string().allow(''),
  REDIS_HOST: Joi.string().default('redis'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow(''),
  REGISTRATION_LIMIT: Joi.number().default(50),
  RUN_SEED: Joi.string().valid('true', 'false').allow(''),
});
