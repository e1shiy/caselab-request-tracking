import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';

import { closeDatabase, insertUser, seedCatalogue, truncateAll, type SeededUser } from '../helpers/db.js';
import { config } from '../../src/config.js';
import { setWeatherScenario, startWeatherStub, stopWeatherStub } from '../helpers/weather.js';
import { api, login, startTestServer, type TestServer } from '../helpers/server.js';

const PASSWORD = 'TestPassword123';

const validEquipment = {
  name: 'Инвертор солнечный',
  type: 'inverter',
  serialNumber: 'INV-0001',
  location: { lat: 55.75, lon: 37.62 },
  status: 'operational',
  installedAt: '2024-03-01',
};

let server: TestServer;
let admin: SeededUser;
let viewer: SeededUser;

beforeAll(async () => {
  config.WEATHER_API_URL = await startWeatherStub();
  setWeatherScenario({
    kind: 'ok',
    days: Array.from({ length: config.WEATHER_FORECAST_DAYS }, () => ({
      precipitationMm: 0,
      windMaxKmph: 5,
    })),
  });
  server = await startTestServer();
});

afterAll(async () => {
  await server.close();
  await stopWeatherStub();
  await closeDatabase();
});

beforeEach(async () => {
  await truncateAll();
  admin = await insertUser({
    email: 'admin@example.test',
    fullName: 'Администратор',
    role: 'admin',
    password: PASSWORD,
  });
  viewer = await insertUser({
    email: 'viewer@example.test',
    fullName: 'Наблюдатель',
    role: 'viewer',
    password: PASSWORD,
  });
});

describe('POST /api/equipment', () => {
  it('администратор создаёт оборудование', async () => {
    const { token } = await login(server, admin.email, PASSWORD);

    const response = await api<{ id: string; serialNumber: string }>(
      server,
      'POST',
      '/api/equipment',
      { token, body: validEquipment },
    );

    expect(response.status).toBe(201);
    expect(response.body.serialNumber).toBe('INV-0001');
  });

  it('наблюдатель получает 403', async () => {
    const { token } = await login(server, viewer.email, PASSWORD);

    const response = await api<{ error: { code: string } }>(server, 'POST', '/api/equipment', {
      token,
      body: validEquipment,
    });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('повторный серийный номер даёт 409', async () => {
    const { token } = await login(server, admin.email, PASSWORD);
    await api(server, 'POST', '/api/equipment', { token, body: validEquipment });

    const response = await api<{ error: { code: string; message: string } }>(
      server,
      'POST',
      '/api/equipment',
      { token, body: { ...validEquipment, name: 'Другой инвертор' } },
    );

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');
  });

  it.each([
    ['короткое название', { name: 'ИВ' }],
    ['неизвестный тип', { type: 'generator' }],
    ['широта вне диапазона', { location: { lat: 120, lon: 37.62 } }],
    ['дата в будущем', { installedAt: '2099-01-01' }],
    ['дата не в формате', { installedAt: '01.03.2024' }],
  ])('отклоняет %s с 422', async (_case, patch) => {
    const { token } = await login(server, admin.email, PASSWORD);

    const response = await api<{ error: { code: string } }>(server, 'POST', '/api/equipment', {
      token,
      body: { ...validEquipment, ...patch },
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/equipment', () => {
  it('наблюдатель читает список с пагинацией', async () => {
    const adminSession = await login(server, admin.email, PASSWORD);
    for (const serial of ['INV-0001', 'INV-0002', 'INV-0003']) {
      await api(server, 'POST', '/api/equipment', {
        token: adminSession.token,
        body: { ...validEquipment, serialNumber: serial },
      });
    }
    const { token } = await login(server, viewer.email, PASSWORD);

    const response = await api<{ data: unknown[]; meta: { total: number; limit: number } }>(
      server,
      'GET',
      '/api/equipment?limit=2',
      { token },
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.meta.total).toBe(3);
    expect(response.body.meta.limit).toBe(2);
  });

  it('сортировка по имени работает', async () => {
    const adminSession = await login(server, admin.email, PASSWORD);
    await api(server, 'POST', '/api/equipment', {
      token: adminSession.token,
      body: { ...validEquipment, name: 'Январь', serialNumber: 'INV-0002' },
    });
    await api(server, 'POST', '/api/equipment', {
      token: adminSession.token,
      body: { ...validEquipment, name: 'Апрель', serialNumber: 'INV-0001' },
    });
    const { token } = await login(server, viewer.email, PASSWORD);

    const response = await api<{ data: { name: string }[] }>(
      server,
      'GET',
      // Формат сортировки: sort=поле для asc и sort=-поле для desc.
      '/api/equipment?sort=name',
      { token },
    );

    expect(response.body.data.map((item) => item.name)).toEqual(['Апрель', 'Январь']);
  });

  it('неизвестное поле сортировки даёт 422', async () => {
    const { token } = await login(server, viewer.email, PASSWORD);
    const response = await api(server, 'GET', '/api/equipment?sort=price', { token });

    expect(response.status).toBe(422);
  });
});

describe('GET /api/equipment/:id', () => {
  it('возвращает карточку и 404 для неизвестного id', async () => {
    const adminSession = await login(server, admin.email, PASSWORD);
    const created = await api<{ id: string }>(server, 'POST', '/api/equipment', {
      token: adminSession.token,
      body: validEquipment,
    });

    const found = await api<{ serialNumber: string }>(
      server,
      'GET',
      `/api/equipment/${created.body.id}`,
      { token: adminSession.token },
    );
    const missing = await api<{ error: { code: string } }>(
      server,
      'GET',
      '/api/equipment/11111111-1111-4111-8111-111111111111',
      { token: adminSession.token },
    );

    expect(found.status).toBe(200);
    expect(found.body.serialNumber).toBe('INV-0001');
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');
  });

  it('некорректный id в пути даёт 422, а не 500', async () => {
    const { token } = await login(server, viewer.email, PASSWORD);
    const response = await api(server, 'GET', '/api/equipment/не-uuid', { token });

    expect(response.status).toBe(422);
  });
});

describe('PATCH и DELETE /api/equipment/:id', () => {
  it('администратор обновляет и удаляет оборудование', async () => {
    const { token } = await login(server, admin.email, PASSWORD);
    const created = await api<{ id: string }>(server, 'POST', '/api/equipment', {
      token,
      body: validEquipment,
    });

    const patched = await api<{ name: string }>(server, 'PATCH', `/api/equipment/${created.body.id}`, {
      token,
      body: { name: 'Инвертор заменён' },
    });
    const deleted = await api(server, 'DELETE', `/api/equipment/${created.body.id}`, { token });
    const afterDelete = await api(server, 'GET', `/api/equipment/${created.body.id}`, { token });

    expect(patched.status).toBe(200);
    expect(patched.body.name).toBe('Инвертор заменён');
    expect(deleted.status).toBe(204);
    expect(afterDelete.status).toBe(404);
  });

  it('пустой PATCH отклоняется', async () => {
    const { token } = await login(server, admin.email, PASSWORD);
    const created = await api<{ id: string }>(server, 'POST', '/api/equipment', {
      token,
      body: validEquipment,
    });

    const response = await api(server, 'PATCH', `/api/equipment/${created.body.id}`, {
      token,
      body: {},
    });

    expect(response.status).toBe(422);
  });

  it('наблюдатель не удаляет оборудование', async () => {
    const adminSession = await login(server, admin.email, PASSWORD);
    const created = await api<{ id: string }>(server, 'POST', '/api/equipment', {
      token: adminSession.token,
      body: validEquipment,
    });
    const { token } = await login(server, viewer.email, PASSWORD);

    const response = await api(server, 'DELETE', `/api/equipment/${created.body.id}`, { token });

    expect(response.status).toBe(403);
  });
});

describe('GET /api/equipment/:id/weather', () => {
  it('отдаёт прогноз из стаба, а не из внешнего сервиса', async () => {
    await seedCatalogue();
    const { token } = await login(server, viewer.email, PASSWORD);
    const catalogue = await api<{ data: { id: string }[] }>(server, 'GET', '/api/equipment', {
      token,
    });

    const response = await api<{ forecast: { suitable: boolean }[] }>(
      server,
      'GET',
      `/api/equipment/${catalogue.body.data[0]!.id}/weather`,
      { token },
    );

    expect(response.status).toBe(200);
    expect(response.body.forecast).toHaveLength(config.WEATHER_FORECAST_DAYS);
    expect(response.body.forecast.every((day) => day.suitable)).toBe(true);
  });

  it('ошибка погодного сервиса превращается в 502', async () => {
    const catalogue = await seedCatalogue();
    const { token } = await login(server, viewer.email, PASSWORD);
    setWeatherScenario({ kind: 'http-error', status: 500 });

    const response = await api<{ error: { code: string } }>(
      server,
      'GET',
      `/api/equipment/${catalogue.equipmentId}/weather`,
      { token },
    );

    expect(response.status).toBe(502);
    expect(response.body.error.code).toBe('EXTERNAL_API_ERROR');
  });
});