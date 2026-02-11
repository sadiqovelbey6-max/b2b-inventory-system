import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, BadRequestException, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  try {
    logger.log('Starting NestJS application...');
    logger.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
      bufferLogs: true,
      logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    });

    logger.log('Application created successfully');

    const configService = app.get(ConfigService);
    const port = configService.get<number>('app.port', 3000);
    const globalPrefix = configService.get<string>('app.globalPrefix', 'api');
    const corsOrigins = configService.get<string[]>('app.corsOrigins', []);

    app.setGlobalPrefix(globalPrefix);
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        exceptionFactory: (errors) => {
          logger.warn('Validation errors:', errors);
          return new BadRequestException({
            message: 'Validation failed',
            errors: errors.map((err) => ({
              property: err.property,
              constraints: err.constraints,
            })),
          });
        },
      }),
    );

    app.enableCors({
      origin: corsOrigins.length ? corsOrigins : true,
      credentials: true,
    });

    const uploadsDir = configService.get<string>(
      'storage.localPath',
      'uploads',
    );
    app.useStaticAssets(join(process.cwd(), uploadsDir));

    const swaggerConfig = new DocumentBuilder()
      .setTitle('B2B Inventory API')
      .setDescription(
        'Emil 1223 tipli inventar və sifariş sistemi üçün REST API sənədi',
      )
      .setVersion('1.1')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);

    logger.log(`Starting server on port ${port}...`);
    await app.listen(port);
    logger.log(
      `Backend server başladı: http://localhost:${port}/${globalPrefix}`,
    );
    logger.log(`Swagger docs: http://localhost:${port}/${globalPrefix}/docs`);
    logger.log(
      `CORS enabled for: ${corsOrigins.length ? corsOrigins.join(', ') : 'all origins'}`,
    );
  } catch (error) {
    logger.error(
      'Backend server başlatıla bilmədi',
      error instanceof Error ? error.stack : String(error),
    );
    if (error instanceof Error) {
      logger.error(`Xəta mesajı: ${error.message}`);
    }
    process.exit(1);
  }
}
void bootstrap();
