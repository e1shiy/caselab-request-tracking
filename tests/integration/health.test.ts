import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';

import { api, startTestServer, type TestServer } from '../helpers/server.js';
import { closeDatabase } from '../helpers/db.js';

let server: TestServer;

beforeAll(async () => {
  server = await startTestServer();
});

afterAll(async () => {
  await server.close();
  await closeDatabase();
});

describe('GET /api/health', () => {
  it('legacy-эндпоинт отвечает без токена и без проверки базы', async () => {
    const response = await api<{ status: string }>(server, 'GET', '/api/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });
});

describe('GET /api/health/live', () => {
  it('отвечает 200 и сообщает время работы', async () => {
    const response = await api<{ status: string; uptimeSeconds: number }>(
      server,
      'GET',
      '/api/health/live',
    );

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('не требует токена', async () => {
    const response = await api(server, 'GET', '/api/health/live');
    expect(response.status).not.toBe(401);
  });
});

describe('GET /api/health/ready', () => {
  it('готов, когда база отвечает', async () => {
    const response = await api<{ status: string; database: string }>(
      server,
      'GET',
      '/api/health/ready',
    );

    expect(response.status).toBe(200);
    expect(response.body.database).toBe('up');
  });
});

describe('GET /metrics', () => {
  it('отдаёт метрики приложения и доступна без токена', async () => {
    const response = await api<string>(server, 'GET', '/metrics');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(response.body).toContain('app_database_up 1');
    expect(response.body).toContain('http_requests_total');
    expect(response.body).toContain('http_request_duration_seconds_bucket');
  });

  it('нормализует маршрут до шаблона, а не до конкретного id', async () => {
    await api(server, 'GET', '/api/equipment/11111111-1111-4111-8111-111111111111');

    const response = await api<string>(server, 'GET', '/metrics');
    expect(response.body).toContain('route="/api/equipment/:id"');
  });
});

describe('GET /api/docs', () => {
  it('Swagger UI и спецификация доступны без токена', async () => {
    const ui = await api<string>(server, 'GET', '/api/docs/');
    const spec = await api<{ openapi: string; paths: Record<string, unknown> }>(
      server,
      'GET',
      '/api/docs/openapi.json',
    );

    expect(ui.status).toBe(200);
    expect(ui.body).toContain('swagger-ui');
    expect(spec.status).toBe(200);
    expect(spec.body.openapi).toBe('3.1.0');
    expect(Object.keys(spec.body.paths).length).toBeGreaterThan(20);
  });
});