/**
 * Full E2E: AppModule + MongoDB + Redis.
 * Tələb: docker compose -f docker-compose.test.yml up -d
 * və MONGODB_URI, REDIS_HOST, REDIS_PORT, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { Response } from 'supertest';
import { AppModule } from '../src/app.module';

describe('App (full e2e)', () => {
  let app: INestApplication;

  jest.setTimeout(30000);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.enableCors({ origin: true, credentials: true });

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health - basic health', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const response: Response = await request(server)
      .get('/api/health')
      .expect(200);

    const body = response.body as {
      status: string;
      uptime: number;
      timestamp: string;
    };

    expect(body.status).toBe('ok');
    expect(body).toHaveProperty('uptime');
    expect(body).toHaveProperty('timestamp');
  });

  it('GET /api/api/health/details - MongoDB və Redis health', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const response: Response = await request(server)
      .get('/api/api/health/details')
      .expect(200);

    const body = response.body as {
      status: string;
      info?: Record<string, { status?: string }>;
      details?: Record<string, { status?: string }>;
    };
    expect(body.status).toBe('ok');
    const healthInfo = body.details ?? body.info ?? {};
    expect(healthInfo.mongodb?.status).toBe('up');
    expect(healthInfo.redis?.status).toBe('up');
  });
});
