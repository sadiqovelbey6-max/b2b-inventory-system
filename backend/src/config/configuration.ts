export default () => ({
  app: {
    port: parseInt(process.env.PORT ?? '4000', 10),
    globalPrefix: 'api',
    corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  },
  database: {
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
    username: process.env.POSTGRES_USER ?? 'b2b_user',
    password: process.env.POSTGRES_PASSWORD ?? 'b2b_pass',
    name: process.env.POSTGRES_DB ?? 'b2b_inventory',
    // MÜHİM: Synchronize-i TAMAMİLƏ SÖNDÜR - məlumatların qorunması üçün
    // Synchronize=true olduqda schema dəyişiklikləri avtomatik tətbiq olunur və məlumatlar silinə bilər
    // Yalnız açıq şəkildə DB_SYNCHRONIZE=true və NODE_ENV!=production olduqda aktiv olur
    // Default: FALSE (məlumatların qorunması üçün)
    synchronize:
      process.env.DB_SYNCHRONIZE === 'true' &&
      process.env.NODE_ENV !== 'production',
  },
  jwt: {
    accessTokenSecret:
      process.env.JWT_ACCESS_SECRET ?? 'development-access-secret',
    refreshTokenSecret:
      process.env.JWT_REFRESH_SECRET ?? 'development-refresh-secret',
    // MÜHİM: Access token müddətini artırdıq ki, istifadəçi tez-tez çıxmasın
    // Əvvəlki: 15m (15 dəqiqə) - çox qısa idi
    // Yeni: 24h (24 saat) - istifadəçi bir gün ərzində çıxmayacaq
    accessTokenTtl: process.env.JWT_ACCESS_TTL ?? '24h',
    refreshTokenTtl: process.env.JWT_REFRESH_TTL ?? '7d',
  },
  storage: {
    driver: process.env.STORAGE_DRIVER ?? 'local',
    localPath: process.env.LOCAL_STORAGE_PATH ?? 'uploads',
    s3: {
      bucket: process.env.S3_BUCKET ?? 'b2b-assets',
      region: process.env.S3_REGION ?? 'us-east-1',
      endpoint: process.env.S3_ENDPOINT ?? '',
      accessKeyId: process.env.S3_ACCESS_KEY ?? '',
      secretAccessKey: process.env.S3_SECRET_KEY ?? '',
      publicUrl: process.env.S3_PUBLIC_URL ?? '',
    },
    limits: {
      maxFileSize: parseInt(
        process.env.STORAGE_MAX_FILE_SIZE ?? String(10 * 1024 * 1024),
        10,
      ),
      allowedMimeTypes: (
        process.env.STORAGE_ALLOWED_MIME ??
        'image/png,image/jpeg,image/webp,application/pdf'
      )
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    },
    image: {
      thumbnailSizes: (() => {
        const values = process.env.STORAGE_IMAGE_SIZES?.split(',') ?? [
          '320x320',
          '640x640',
        ];
        const sizes: Array<{ width: number; height?: number }> = [];
        for (const raw of values) {
          const value = raw.trim();
          if (!value) continue;
          const [widthPart, heightPart] = value.split('x');
          const width = Number.parseInt(widthPart ?? '', 10);
          if (!Number.isFinite(width)) continue;
          const parsedHeight = heightPart
            ? Number.parseInt(heightPart, 10)
            : undefined;
          sizes.push({
            width,
            height:
              parsedHeight !== undefined && Number.isFinite(parsedHeight)
                ? parsedHeight
                : undefined,
          });
        }
        return sizes;
      })(),
    },
  },
  mail: {
    host: process.env.SMTP_HOST ?? '',
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER ?? '',
    password: process.env.SMTP_PASSWORD ?? '',
    from: process.env.SMTP_FROM ?? 'no-reply@b2b-inventory.local',
  },
  twoFactor: {
    issuer: process.env.TWO_FACTOR_ISSUER ?? 'B2B Inventory',
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD ?? '',
  },
  registration: {
    limit: parseInt(process.env.REGISTRATION_LIMIT ?? '50', 10),
  },
  mongodb: {
    uri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/b2b_inventory',
  },
});
