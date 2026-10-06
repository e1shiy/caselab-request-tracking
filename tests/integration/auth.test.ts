import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';

import { closeDatabase, insertUser, truncateAll, type SeededUser } from '../helpers/db.js';
import { api, login, startTestServer, type TestServer } from '../helpers/server.js';

// Пароль обязан содержать латинские строчные и прописные буквы и цифры:
// таковы требования registerSchema.
const PASSWORD = 'TestPassword123';

let server: TestServer;
let admin: SeededUser;

beforeAll(async () => {
  server = await startTestServer();
});

afterAll(async () => {
  await server.close();
  await closeDatabase();
});

beforeEach(async () => {
  await truncateAll();
  admin = await insertUser({
    email: 'admin@example.test',
    fullName: 'Администратор Тестовый',
    role: 'admin',
    password: PASSWORD,
  });
});

interface TokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: { id: string; role: string; email: string };
}

describe('POST /api/auth/register', () => {
  it('создаёт наблюдателя и выдаёт токены', async () => {
    const response = await api<TokenResponse>(server, 'POST', '/api/auth/register', {
      body: { email: 'New.User@Example.Test', password: PASSWORD, fullName: 'Новый Пользователь' },
    });

    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe('new.user@example.test');
    expect(response.body.user.role).toBe('viewer');
    expect(response.body.accessToken).toBeTruthy();
    expect(response.body.tokenType).toBe('Bearer');
    expect(response.body.expiresIn).toBeGreaterThan(0);
    expect(response.setCookie).toContain('refresh_token=');
  });

  it('выданный токен сразу работает на /me', async () => {
    const registered = await api<TokenResponse>(server, 'POST', '/api/auth/register', {
      body: { email: 'self@example.test', password: PASSWORD, fullName: 'Сам Войдёт' },
    });

    const me = await api<{ email: string; role: string }>(server, 'GET', '/api/auth/me', {
      token: registered.body.accessToken,
    });

    expect(me.status).toBe(200);
    expect(me.body.email).toBe('self@example.test');
  });

  it.each([
    ['короткий пароль', { email: 'a@example.test', password: 'Ab1', fullName: 'Тест' }],
    ['пароль без цифр', { email: 'b@example.test', password: 'NoDigitsHere', fullName: 'Тест' }],
    ['некорректный email', { email: 'не-email', password: PASSWORD, fullName: 'Тест' }],
    ['короткое ФИО', { email: 'c@example.test', password: PASSWORD, fullName: 'Т' }],
  ])('отклоняет %s с 422', async (_case, body) => {
    const response = await api<{ error: { code: string } }>(
      server,
      'POST',
      '/api/auth/register',
      { body },
    );

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('повторная регистрация того же email даёт 409', async () => {
    const body = { email: 'twice@example.test', password: PASSWORD, fullName: 'Дважды' };
    await api(server, 'POST', '/api/auth/register', { body });

    const response = await api<{ error: { code: string } }>(server, 'POST', '/api/auth/register', {
      body,
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');
  });
});

describe('POST /api/auth/login', () => {
  it('возвращает токены и refresh-cookie с флагами', async () => {
    const response = await api<TokenResponse>(server, 'POST', '/api/auth/login', {
      body: { email: admin.email, password: PASSWORD },
    });

    expect(response.status).toBe(200);
    expect(response.body.user.role).toBe('admin');
    expect(response.setCookie).toContain('HttpOnly');
    expect(response.setCookie).toContain('SameSite=Lax');
    expect(response.setCookie).toContain('Path=/api/auth');
  });

  it('неверный пароль и неизвестный email дают одинаковый 401', async () => {
    const wrongPassword = await api<{ error: { message: string } }>(
      server,
      'POST',
      '/api/auth/login',
      { body: { email: admin.email, password: 'WrongPassword123' } },
    );
    const unknownEmail = await api<{ error: { message: string } }>(
      server,
      'POST',
      '/api/auth/login',
      { body: { email: 'nobody@example.test', password: PASSWORD } },
    );

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe('Неверный email или пароль');
    expect(unknownEmail.body.error.message).toBe('Неверный email или пароль');
  });

  it('email нечувствителен к регистру', async () => {
    const response = await api<TokenResponse>(server, 'POST', '/api/auth/login', {
      body: { email: 'ADMIN@EXAMPLE.TEST', password: PASSWORD },
    });

    expect(response.status).toBe(200);
  });
});

describe('GET /api/auth/me', () => {
  it('без токена даёт 401', async () => {
    const response = await api<{ error: { code: string } }>(server, 'GET', '/api/auth/me');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('мусорный токен даёт 401, а не 500', async () => {
    const response = await api<{ error: { code: string } }>(server, 'GET', '/api/auth/me', {
      token: 'not-a-token',
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('POST /api/auth/refresh', () => {
  it('ротирует refresh-токен и возвращает новую пару', async () => {
    const first = await login(server, admin.email, PASSWORD);
    const refreshed = await api<TokenResponse>(server, 'POST', '/api/auth/refresh', {
      cookie: first.refreshCookie,
    });

    expect(refreshed.status).toBe(200);
    expect(refreshed.body.accessToken).toBeTruthy();
    expect(refreshed.setCookie).not.toContain(first.refreshCookie.split('=')[1]!.split(';')[0]);
  });

  it('старый refresh-токен после ротации больше не работает и отзывает все сессии', async () => {
    const first = await login(server, admin.email, PASSWORD);
    const second = await login(server, admin.email, PASSWORD);
    await api(server, 'POST', '/api/auth/refresh', { cookie: first.refreshCookie });

    // Повторное использование уже отозванного токена считается кражей:
    // сервер отзывает и второй, ещё живой refresh-токен.
    const reuse = await api<{ error: { code: string } }>(server, 'POST', '/api/auth/refresh', {
      cookie: first.refreshCookie,
    });
    const afterRevoke = await api(server, 'POST', '/api/auth/refresh', {
      cookie: second.refreshCookie,
    });

    expect(reuse.status).toBe(401);
    expect(afterRevoke.status).toBe(401);
  });

  it('без cookie даёт 401', async () => {
    const response = await api(server, 'POST', '/api/auth/refresh');

    expect(response.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('отзывает refresh-токен и чистит cookie', async () => {
    const session = await login(server, admin.email, PASSWORD);

    const logout = await api(server, 'POST', '/api/auth/logout', { cookie: session.refreshCookie });
    const afterLogout = await api(server, 'POST', '/api/auth/refresh', {
      cookie: session.refreshCookie,
    });

    expect(logout.status).toBe(204);
    expect(afterLogout.status).toBe(401);
  });
});

describe('отключённая учётная запись', () => {
  it('не пускает даже с верным паролем', async () => {
    const disabled = await insertUser({
      email: 'disabled@example.test',
      fullName: 'Отключённый',
      role: 'viewer',
      password: PASSWORD,
      isActive: false,
    });

    const response = await api<{ error: { message: string } }>(server, 'POST', '/api/auth/login', {
      body: { email: disabled.email, password: PASSWORD },
    });

    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe('Учётная запись отключена');
  });
});