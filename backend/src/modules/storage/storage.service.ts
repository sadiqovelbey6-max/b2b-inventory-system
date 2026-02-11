import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { dirname, join, normalize } from 'path';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import sharp from 'sharp';

type StorageDriver = 'local' | 's3';

export interface UploadPayload {
  buffer: Buffer | Readable;
  key: string;
  contentType?: string;
  acl?: 'private' | 'public-read';
  originalName?: string;
}

type SharpFit = 'cover' | 'contain' | 'fill' | 'inside' | 'outside';

export interface ThumbnailOption {
  suffix?: string;
  width: number;
  height?: number;
  fit?: SharpFit;
}

export interface StorageUploadOptions {
  contentType?: string;
  acl?: 'private' | 'public-read';
  maxSizeBytes?: number;
  allowedMimeTypes?: string[];
  generateThumbnails?: ThumbnailOption[];
}

export interface StorageThumbnailResult {
  key: string;
  url: string;
  width: number;
  height?: number;
}

export interface UploadResult {
  key: string;
  url: string;
  thumbnails?: StorageThumbnailResult[];
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver: StorageDriver;
  private readonly localRoot: string;
  private readonly s3Client?: S3Client;
  private readonly bucket?: string;
  private readonly publicUrlPrefix?: string;
  private readonly defaultMaxFileSize: number;
  private readonly defaultAllowedMime: string[];
  private readonly defaultThumbnailSizes: ThumbnailOption[];

  constructor(private readonly configService: ConfigService) {
    this.driver =
      this.configService.get<StorageDriver>('storage.driver') ?? 'local';
    this.localRoot = join(
      process.cwd(),
      this.configService.get<string>('storage.localPath', 'uploads'),
    );

    this.defaultMaxFileSize =
      this.configService.get<number>('storage.limits.maxFileSize') ??
      10 * 1024 * 1024;
    this.defaultAllowedMime =
      this.configService.get<string[]>('storage.limits.allowedMimeTypes') ?? [];
    const rawThumbnailSizes =
      this.configService.get<Array<{ width?: number; height?: number }>>(
        'storage.image.thumbnailSizes',
      ) ?? [];
    this.defaultThumbnailSizes = rawThumbnailSizes
      .filter((item) => Number.isFinite(item.width))
      .map((item) => ({
        width: Number(item.width),
        height: item.height
          ? Number(item.height)
          : item.width
            ? Number(item.width)
            : undefined,
      }));

    if (this.driver === 's3') {
      const bucket = this.configService.get<string>('storage.s3.bucket');
      const region = this.configService.get<string>('storage.s3.region');
      const endpoint =
        this.configService.get<string>('storage.s3.endpoint') || undefined;
      const accessKeyId =
        this.configService.get<string>('storage.s3.accessKeyId') ??
        this.configService.get<string>('storage.s3.accessKey');
      const secretAccessKey =
        this.configService.get<string>('storage.s3.secretAccessKey') ??
        this.configService.get<string>('storage.s3.secretKey');

      if (!bucket || !region || !accessKeyId || !secretAccessKey) {
        throw new Error('S3 storage configuration is incomplete');
      }

      this.bucket = bucket;
      this.publicUrlPrefix = this.configService.get<string>(
        'storage.s3.publicUrl',
      );
      this.s3Client = new S3Client({
        region,
        endpoint,
        forcePathStyle: Boolean(endpoint),
        credentials: { accessKeyId, secretAccessKey },
      });
    }
  }

  private normalizeKey(key: string) {
    return normalize(key).replace(/\\+/g, '/').replace(/^\/+/, '');
  }

  async upload(
    payload: UploadPayload,
    options: StorageUploadOptions = {},
  ): Promise<UploadResult> {
    const key = this.normalizeKey(payload.key);
    const contentType =
      payload.contentType ?? options.contentType ?? 'application/octet-stream';
    const buffer = await this.asBuffer(payload.buffer);

    this.validateBuffer(buffer, contentType, options, payload.originalName);

    const url = await this.putObject(
      key,
      buffer,
      contentType,
      options.acl ?? payload.acl ?? 'private',
    );

    const generateThumbs =
      options.generateThumbnails ?? this.defaultThumbnailSizes;
    let thumbnails: StorageThumbnailResult[] | undefined;

    if (
      generateThumbs.length > 0 &&
      this.isImageMime(contentType) &&
      buffer.length > 0
    ) {
      thumbnails = await this.createThumbnails(
        key,
        buffer,
        contentType,
        options.acl ?? payload.acl ?? 'private',
        generateThumbs,
      );
    }

    return thumbnails ? { key, url, thumbnails } : { key, url };
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    if (this.driver === 'local') {
      return `/${this.normalizeKey(key)}`;
    }

    if (!this.s3Client || !this.bucket) {
      throw new InternalServerErrorException('S3 client is not configured');
    }

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: this.normalizeKey(key),
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  async remove(key: string) {
    const normalizedKey = this.normalizeKey(key);

    if (this.driver === 'local') {
      try {
        await fs.unlink(join(this.localRoot, normalizedKey));
      } catch (error) {
        this.logger.warn(
          `Fayl silinərkən problem: ${normalizedKey} - ${String(error)}`,
        );
      }
      return;
    }

    if (!this.s3Client || !this.bucket) {
      throw new InternalServerErrorException('S3 client is not configured');
    }

    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: normalizedKey,
      }),
    );
  }

  private async putObject(
    key: string,
    buffer: Buffer,
    contentType: string,
    acl: 'private' | 'public-read',
  ): Promise<string> {
    const normalizedKey = this.normalizeKey(key);

    if (this.driver === 'local') {
      const target = join(this.localRoot, normalizedKey);
      await fs.mkdir(dirname(target), { recursive: true });
      await fs.writeFile(target, buffer);
      return `/${normalizedKey}`;
    }

    if (!this.s3Client || !this.bucket) {
      throw new InternalServerErrorException('S3 client is not configured');
    }

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: normalizedKey,
        Body: buffer,
        ContentType: contentType,
        ACL: acl,
      }),
    );

    if (acl === 'public-read') {
      if (this.publicUrlPrefix) {
        return `${this.publicUrlPrefix.replace(/\/$/, '')}/${normalizedKey}`;
      }
      const region = this.configService.get<string>('storage.s3.region');
      return `https://${this.bucket}.s3.${region}.amazonaws.com/${normalizedKey}`;
    }

    return this.getSignedUrl(normalizedKey);
  }

  private async createThumbnails(
    originalKey: string,
    buffer: Buffer,
    contentType: string,
    acl: 'private' | 'public-read',
    thumbnails: ThumbnailOption[],
  ) {
    const results: StorageThumbnailResult[] = [];

    for (const thumb of thumbnails) {
      if (!thumb.width || thumb.width < 1) continue;

      const height =
        thumb.height && thumb.height > 0 ? thumb.height : thumb.width;

      try {
        const fit = thumb.fit ?? 'cover';
        const resized = await sharp(buffer)
          .resize(thumb.width, height, {
            fit: fit as keyof sharp.FitEnum,
          })
          .toBuffer();

        const thumbKey = this.appendSuffix(
          originalKey,
          thumb.suffix ?? `${thumb.width}x${height}`,
        );
        const url = await this.putObject(thumbKey, resized, contentType, acl);
        results.push({
          key: thumbKey,
          url,
          width: thumb.width,
          height,
        });
      } catch (error) {
        this.logger.warn(
          `Thumbnail generasiyası uğursuz oldu (${originalKey}): ${String(
            error,
          )}`,
        );
      }
    }

    return results;
  }

  private appendSuffix(key: string, suffix: string) {
    const normalized = this.normalizeKey(key);
    const dotIndex = normalized.lastIndexOf('.');
    if (dotIndex === -1) {
      return `${normalized}_${suffix}`;
    }
    const name = normalized.slice(0, dotIndex);
    const ext = normalized.slice(dotIndex);
    return `${name}_${suffix}${ext}`;
  }

  private async asBuffer(source: Buffer | Readable): Promise<Buffer> {
    if (Buffer.isBuffer(source)) {
      return source;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of source) {
      if (Buffer.isBuffer(chunk)) {
        chunks.push(chunk);
      } else if (typeof chunk === 'string') {
        chunks.push(Buffer.from(chunk));
      } else if (chunk instanceof Uint8Array) {
        chunks.push(Buffer.from(chunk));
      } else {
        throw new InternalServerErrorException(
          `Unsupported stream chunk type: ${typeof chunk}`,
        );
      }
    }
    return Buffer.concat(chunks);
  }

  private validateBuffer(
    buffer: Buffer,
    contentType: string,
    options: StorageUploadOptions,
    originalName?: string,
  ) {
    const maxSize = options.maxSizeBytes ?? this.defaultMaxFileSize;
    if (maxSize && buffer.length > maxSize) {
      throw new BadRequestException(
        `Fayl ölçüsü limitini aşır (${this.formatBytes(buffer.length)} > ${this.formatBytes(maxSize)})`,
      );
    }

    const allowedMime =
      options.allowedMimeTypes ?? this.defaultAllowedMime ?? [];
    if (
      allowedMime.length > 0 &&
      !allowedMime.includes(contentType.toLowerCase())
    ) {
      throw new BadRequestException(
        `Bu fayl növü dəstəklənmir (${contentType})${
          originalName ? ` - ${originalName}` : ''
        }`,
      );
    }
  }

  private formatBytes(value: number) {
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    if (value < 1024 * 1024 * 1024) {
      return `${(value / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  private isImageMime(mime: string) {
    return mime.startsWith('image/');
  }
}
