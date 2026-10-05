import type { AddressInfo } from 'node:net';

import type { Express } from 'express';

import { createApp } from '../../src/app.js';
import type { Storage } from '../../src/repositories/index.js';
import { createStorage } from '../../src/repositories/storage.js';

export interface TestServer {
  baseUrl: string;
  app: Express;
  storage: Storage;
  close: () => Promise<void>;
}

/**
 * Поднимает настоящее приложение на случайном порту. Тесты ходят по HTTP
 * (fetch), а не вызывают контроллеры напрямую: иначе не проверялись бы
 * middleware, валидация и коды ошибок, ради которых suite и написан.
 */
export async function startTestServer(): Promise<TestServer> {
  const storage = await createStorage();
  const app = createApp(storage);

  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  const address = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    app,
    storage,
    close: async () => {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
      server.closeAllConnections();
      await storage.close();
    },
  };
}

export interface ApiResponse<T = unknown> {
  status: number;
  body: T;
  headers: Headers;
  setCookie: string;
}

export interface ApiRequestOptions {
  token?: string;
  body?: unknown;
  headers?: Record<string, string>;
  cookie?: string;
}

/** Обёртка над fetch: возвращает статус, разобранное тело и заголовки. */
export async function api<T = unknown>(
  server: TestServer,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  options: ApiRequestOptions = {},
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = { ...options.headers };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  if (options.cookie) headers.cookie = options.cookie;
  if (options.body !== undefined) headers['content-type'] = 'application/json';

  const response = await fetch(`${server.baseUrl}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await response.text();
  let body: unknown = text;
  if (text.length > 0) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = text;
    }
  }

  return {
    status: response.status,
    body: body as T,
    headers: response.headers,
    setCookie: response.headers.get('set-cookie') ?? '',
  };
}

/** Запрос с телом как есть: нужен для битого JSON и превышения лимита размера. */
export async function rawRequest<T = unknown>(
  server: TestServer,
  method: 'POST' | 'PUT' | 'PATCH',
  path: string,
  body: string,
  options: { token?: string; contentType?: string } = {},
): Promise<{ status: number; body: T; headers: Headers }> {
  const headers: Record<string, string> = {
    'content-type': options.contentType ?? 'application/json',
  };
  if (options.token !== undefined) headers.authorization = `Bearer ${options.token}`;

  const response = await fetch(`${server.baseUrl}${path}`, { method, headers, body });
  const text = await response.text();

  let parsed: unknown = text;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = text;
    }
  }

  return { status: response.status, body: parsed as T, headers: response.headers };
}

/** Достаёт access-токен из тела ответа входа. */
export async function login(
  server: TestServer,
  email: string,
  password: string,
): Promise<{ token: string; refreshCookie: string }> {
  const response = await api<{ accessToken: string }>(server, 'POST', '/api/auth/login', {
    body: { email, password },
  });
  if (response.status !== 200) {
    throw new Error(`вход ${email} не удался: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return {
    token: response.body.accessToken,
    refreshCookie: response.setCookie.split(';')[0] ?? '',
  };
}