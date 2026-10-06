import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';

import { config } from '../../src/config.js';
import { closeDatabase, insertUser, truncateAll } from '../helpers/db.js';
import { api, login, rawRequest, startTestServer, type TestServer } from '../helpers/server.js';

const PASSWORD = 'TestPassword123';

interface ErrorBody {
  error: { code: string; message: string; requestId: string };
}

let server: TestServer;

beforeAll(async () => {
  server = await startTestServer();
});

afterAll(async () => {
  await server.close();
  await closeDatabase();
});

describe('пределы и некорректные запросы', () => {
  it('тело больше лимита даёт 413 PAYLOAD_TOO_LARGE', async () => {
    const limitKb = Number.parseInt(config.BODY_LIMIT, 10);
    const oversized = JSON.stringify({ description: 'я'.repeat(limitKb * 1024 + 1024) });

    const response = await rawRequest<ErrorBody>(server, 'POST', '/api/auth/login', oversized);

    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(response.body.error.message).toContain('превышает');
  });

  it('битый JSON даёт 400 INVALID_JSON, а не 500', async () => {
    const response = await rawRequest<ErrorBody>(server, 'POST', '/api/auth/login', '{"email": ');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_JSON');
  });

  it('аутентификация стоит раньше маршрутизации: без токена неизвестный путь даёт 401', async () => {
    const response = await api<ErrorBody>(server, 'GET', '/api/nope');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('с токеном неизвестный путь даёт 404 NOT_FOUND', async () => {
    await truncateAll();
    const admin = await insertUser({
      email: 'admin@example.test',
      fullName: 'Администратор',
      role: 'admin',
      password: PASSWORD,
    });
    const { token } = await login(server, admin.email, PASSWORD);

    const response = await api<ErrorBody>(server, 'GET', '/api/nope', { token });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('неподдерживаемый метод не приводит к 500', async () => {
    await truncateAll();
    const admin = await insertUser({
      email: 'admin@example.test',
      fullName: 'Администратор',
      role: 'admin',
      password: PASSWORD,
    });
    const { token } = await login(server, admin.email, PASSWORD);

    const response = await api<ErrorBody>(server, 'DELETE', '/api/requests', { token });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('каждый ответ несёт requestId, а заголовок совпадает с телом', async () => {
    const response = await api<ErrorBody>(server, 'GET', '/api/nope');

    expect(response.headers.get('x-request-id')).toBe(response.body.error.requestId);
  });
});