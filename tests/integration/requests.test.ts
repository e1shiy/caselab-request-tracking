import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';

import {
  closeDatabase,
  insertUser,
  seedCatalogue,
  truncateAll,
  type SeededCatalogue,
  type SeededUser,
} from '../helpers/db.js';
import { api, login, startTestServer, type TestServer } from '../helpers/server.js';

const PASSWORD = 'TestPassword123';

let server: TestServer;
let admin: SeededUser;
let technician: SeededUser;
let outsider: SeededUser;
let viewer: SeededUser;
let catalogue: SeededCatalogue;

const newRequest = {
  title: 'Заменить фильтр',
  description: 'Течёт гидростанция',
  priority: 'high',
};

beforeAll(async () => {
  server = await startTestServer();
});

afterAll(async () => {
  await server.close();
  await closeDatabase();
});

beforeEach(async () => {
  await truncateAll();
  catalogue = await seedCatalogue();
  admin = await insertUser({
    email: 'admin@example.test',
    fullName: 'Администратор',
    role: 'admin',
    password: PASSWORD,
  });
  technician = await insertUser({
    email: 'tech1@example.test',
    fullName: 'Первый Техник',
    role: 'technician',
    password: PASSWORD,
    technicianId: catalogue.technicianIds[0]!,
  });
  outsider = await insertUser({
    email: 'tech2@example.test',
    fullName: 'Второй Техник',
    role: 'technician',
    password: PASSWORD,
    technicianId: catalogue.technicianIds[1]!,
  });
  viewer = await insertUser({
    email: 'viewer@example.test',
    fullName: 'Наблюдатель',
    role: 'viewer',
    password: PASSWORD,
  });
});

async function createRequest(token: string): Promise<string> {
  const response = await api<{ id: string }>(server, 'POST', '/api/requests', {
    token,
    body: { ...newRequest, equipmentId: catalogue.equipmentId },
  });
  if (response.status !== 201) {
    throw new Error(`заявка не создана: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return response.body.id;
}

describe('POST /api/requests', () => {
  it('автор берётся из токена, а не из тела запроса', async () => {
    const { token } = await login(server, technician.email, PASSWORD);

    const response = await api<{ author: string }>(server, 'POST', '/api/requests', {
      token,
      body: { ...newRequest, equipmentId: catalogue.equipmentId, author: 'Подделка' },
    });

    expect(response.status).toBe(201);
    expect(response.body.author).toBe('Первый Техник');
  });

  it('наблюдатель не может создать заявку', async () => {
    const { token } = await login(server, viewer.email, PASSWORD);

    const response = await api<{ error: { code: string } }>(server, 'POST', '/api/requests', {
      token,
      body: { ...newRequest, equipmentId: catalogue.equipmentId },
    });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('несуществующее оборудование даёт 404', async () => {
    const { token } = await login(server, technician.email, PASSWORD);

    const response = await api<{ error: { code: string } }>(server, 'POST', '/api/requests', {
      token,
      body: { ...newRequest, equipmentId: '11111111-1111-4111-8111-111111111111' },
    });

    expect(response.status).toBe(404);
  });

  it.each([
    ['короткий заголовок', { title: 'ИВ' }],
    ['неизвестный приоритет', { priority: 'urgent' }],
    ['плохая дата планирования', { plannedAt: 'завтра' }],
  ])('отклоняет %s с 422', async (_case, patch) => {
    const { token } = await login(server, technician.email, PASSWORD);

    const response = await api(server, 'POST', '/api/requests', {
      token,
      body: { ...newRequest, ...patch, equipmentId: catalogue.equipmentId },
    });

    expect(response.status).toBe(422);
  });
});

describe('жизненный цикл заявки', () => {
  it('new → in_progress → done с записью в журнал', async () => {
    const { token } = await login(server, admin.email, PASSWORD);
    const id = await createRequest(token);

    // Без бригады перевод в работу запрещён.
    const withoutCrew = await api<{ error: { message: string } }>(
      server,
      'PATCH',
      `/api/requests/${id}/status`,
      { token, body: { status: 'in_progress' } },
    );
    expect(withoutCrew.status).toBe(409);
    expect(withoutCrew.body.error.message).toContain('требует назначенной бригады');

    const crew = await api<{ assignees: { role: string }[] }>(
      server,
      'POST',
      `/api/requests/${id}/assignees`,
      {
        token,
        body: {
          assignees: [
            { technicianId: catalogue.technicianIds[0]!, role: 'lead', plannedHours: 4 },
            { technicianId: catalogue.technicianIds[1]!, role: 'member' },
          ],
        },
      },
    );
    expect(crew.status).toBe(201);
    expect(crew.body.assignees).toHaveLength(2);

    const inProgress = await api<{ status: string }>(server, 'PATCH', `/api/requests/${id}/status`, {
      token,
      body: { status: 'in_progress', comment: 'Выезд начат' },
    });
    const done = await api<Record<string, unknown>>(server, 'PATCH', `/api/requests/${id}/status`, {
      token,
      body: { status: 'done' },
    });
    const history = await api<{ data: { newStatus: string; changedBy: string; comment?: string }[] }>(
      server,
      'GET',
      `/api/requests/${id}/history`,
      { token },
    );

    expect(inProgress.body.status).toBe('in_progress');
    expect(done.body.status).toBe('done');
    // Дата закрытия остаётся внутренним полем: в карточке наружу не отдаётся,
    // аудит ведётся журналом статусов.
    expect(done.body).not.toHaveProperty('closedAt');
    // Журнал отдаётся от свежих записей к старым и содержит создание заявки.
    expect(history.body.data.map((entry) => entry.newStatus)).toEqual(['done', 'in_progress', 'new']);
    expect(history.body.data.every((entry) => entry.changedBy === 'Администратор')).toBe(true);
    expect(history.body.data[1]?.comment).toBe('Выезд начат');
  });

  it('повторный переход в тот же статус даёт 409', async () => {
    const { token } = await login(server, admin.email, PASSWORD);
    const id = await createRequest(token);
    await api(server, 'POST', `/api/requests/${id}/assignees`, {
      token,
      body: { assignees: [{ technicianId: catalogue.technicianIds[0]!, role: 'lead' }] },
    });
    await api(server, 'PATCH', `/api/requests/${id}/status`, { token, body: { status: 'in_progress' } });

    const repeated = await api<{ error: { message: string } }>(
      server,
      'PATCH',
      `/api/requests/${id}/status`,
      { token, body: { status: 'in_progress' } },
    );

    expect(repeated.status).toBe(409);
    expect(repeated.body.error.message).toContain('уже находится в статусе');
  });

  it('из закрытой заявки нельзя выйти повторно', async () => {
    const { token } = await login(server, admin.email, PASSWORD);
    const id = await createRequest(token);
    await api(server, 'PATCH', `/api/requests/${id}/status`, { token, body: { status: 'rejected' } });

    const response = await api<{ error: { message: string } }>(
      server,
      'PATCH',
      `/api/requests/${id}/status`,
      { token, body: { status: 'in_progress' } },
    );

    expect(response.status).toBe(409);
    expect(response.body.error.message).toContain('недопустим');
  });

  it('удалять заявки может только администратор', async () => {
    const { token: adminToken } = await login(server, admin.email, PASSWORD);
    const byTechnician = await createRequest(adminToken);
    const byAdmin = await createRequest(adminToken);
    await api(server, 'POST', `/api/requests/${byTechnician}/assignees`, {
      token: adminToken,
      body: { assignees: [{ technicianId: catalogue.technicianIds[0]!, role: 'lead' }] },
    });
    const { token } = await login(server, technician.email, PASSWORD);

    const forbidden = await api<{ error: { code: string } }>(
      server,
      'DELETE',
      `/api/requests/${byTechnician}`,
      { token },
    );
    const removed = await api(server, 'DELETE', `/api/requests/${byAdmin}`, { token: adminToken });
    const gone = await api(server, 'GET', `/api/requests/${byAdmin}`, { token: adminToken });

    expect(forbidden.status).toBe(403);
    expect(removed.status).toBe(204);
    expect(gone.status).toBe(404);
  });

  it('бригаду закрытой заявки менять нельзя', async () => {
    const { token } = await login(server, admin.email, PASSWORD);
    const id = await createRequest(token);
    await api(server, 'PATCH', `/api/requests/${id}/status`, { token, body: { status: 'rejected' } });

    const response = await api<{ error: { message: string } }>(
      server,
      'POST',
      `/api/requests/${id}/assignees`,
      {
        token,
        body: { assignees: [{ technicianId: catalogue.technicianIds[0]!, role: 'lead' }] },
      },
    );

    expect(response.status).toBe(409);
    expect(response.body.error.message).toContain('Бригаду нельзя изменить');
  });
});

describe('роли и назначения', () => {
  it('назначенный техник меняет статус, неназначенный получает 403', async () => {
    const { token: adminToken } = await login(server, admin.email, PASSWORD);
    const id = await createRequest(adminToken);
    await api(server, 'POST', `/api/requests/${id}/assignees`, {
      token: adminToken,
      body: { assignees: [{ technicianId: catalogue.technicianIds[0]!, role: 'lead' }] },
    });

    const { token: assigned } = await login(server, technician.email, PASSWORD);
    const { token: notAssigned } = await login(server, outsider.email, PASSWORD);

    const allowed = await api<{ status: string }>(server, 'PATCH', `/api/requests/${id}/status`, {
      token: assigned,
      body: { status: 'in_progress' },
    });
    const forbidden = await api<{ error: { message: string } }>(
      server,
      'PATCH',
      `/api/requests/${id}/status`,
      { token: notAssigned, body: { status: 'done' } },
    );

    expect(allowed.status).toBe(200);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.message).toContain('только заявки, на которые он назначен');
  });

  it('ведущего нельзя снять, пока в бригаде есть другие', async () => {
    const { token } = await login(server, admin.email, PASSWORD);
    const id = await createRequest(token);
    await api(server, 'POST', `/api/requests/${id}/assignees`, {
      token,
      body: {
        assignees: [
          { technicianId: catalogue.technicianIds[0]!, role: 'lead' },
          { technicianId: catalogue.technicianIds[1]!, role: 'member' },
        ],
      },
    });

    const response = await api<{ error: { message: string } }>(
      server,
      'DELETE',
      `/api/requests/${id}/assignees/${catalogue.technicianIds[0]!}`,
      { token },
    );

    expect(response.status).toBe(409);
    expect(response.body.error.message).toContain('Нельзя снять ведущего');
  });

  it('снятие единственного ведущего проходит, бригада пустеет', async () => {
    const { token } = await login(server, admin.email, PASSWORD);
    const id = await createRequest(token);
    await api(server, 'POST', `/api/requests/${id}/assignees`, {
      token,
      body: { assignees: [{ technicianId: catalogue.technicianIds[0]!, role: 'lead' }] },
    });

    const response = await api<{ assignees: unknown[] }>(
      server,
      'DELETE',
      `/api/requests/${id}/assignees/${catalogue.technicianIds[0]!}`,
      { token },
    );

    expect(response.status).toBe(200);
    expect(response.body.assignees).toHaveLength(0);
  });

  it('в бригаде должен быть ровно один ведущий', async () => {
    const { token } = await login(server, admin.email, PASSWORD);
    const id = await createRequest(token);

    const response = await api<{ error: { details: unknown } }>(
      server,
      'POST',
      `/api/requests/${id}/assignees`,
      {
        token,
        body: {
          assignees: [
            { technicianId: catalogue.technicianIds[0]!, role: 'member' },
            { technicianId: catalogue.technicianIds[1]!, role: 'member' },
          ],
        },
      },
    );

    expect(response.status).toBe(422);
    expect(JSON.stringify(response.body.error.details)).toContain('ровно один ведущий');
  });

  it('несуществующий специалист даёт 404, а не 422', async () => {
    const { token } = await login(server, admin.email, PASSWORD);
    const id = await createRequest(token);

    const response = await api<{ error: { code: string } }>(
      server,
      'POST',
      `/api/requests/${id}/assignees`,
      {
        token,
        body: {
          assignees: [{ technicianId: '11111111-1111-4111-8111-111111111111', role: 'lead' }],
        },
      },
    );

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('наблюдатель читает заявки, но не меняет', async () => {
    const { token: adminToken } = await login(server, admin.email, PASSWORD);
    const id = await createRequest(adminToken);
    const { token } = await login(server, viewer.email, PASSWORD);

    const read = await api<{ id: string }>(server, 'GET', `/api/requests/${id}`, { token });
    const write = await api(server, 'PATCH', `/api/requests/${id}/status`, {
      token,
      body: { status: 'rejected' },
    });

    expect(read.status).toBe(200);
    expect(write.status).toBe(403);
  });
});

describe('списки, фильтры и отчёты', () => {
  it('фильтры по статусу и приоритету работают вместе с пагинацией', async () => {
    const { token } = await login(server, admin.email, PASSWORD);
    const first = await createRequest(token);
    const second = await createRequest(token);
    await api(server, 'PATCH', `/api/requests/${second}/status`, {
      token,
      body: { status: 'rejected' },
    });

    const newOnly = await api<{ data: { id: string }[]; meta: { total: number } }>(
      server,
      'GET',
      '/api/requests?status=new&limit=1',
      { token },
    );
    const rejected = await api<{ meta: { total: number } }>(
      server,
      'GET',
      '/api/requests?status=rejected',
      { token },
    );
    const byEquipment = await api<{ meta: { total: number } }>(
      server,
      'GET',
      `/api/requests?equipmentId=${catalogue.equipmentId}`,
      { token },
    );

    expect(newOnly.body.meta.total).toBe(1);
    expect(newOnly.body.data).toHaveLength(1);
    expect(newOnly.body.data[0]?.id).toBe(first);
    expect(rejected.body.meta.total).toBe(1);
    expect(byEquipment.body.meta.total).toBe(2);
  });

  it('сводка по площадке считает заявки по статусам и приоритетам', async () => {
    const { token } = await login(server, admin.email, PASSWORD);
    await createRequest(token);
    await createRequest(token);

    const summary = await api<{
      siteCode: string;
      equipmentTotal: number;
      requestsTotal: number;
      byStatus: Record<string, number>;
      byPriority: Record<string, number>;
    }>(server, 'GET', `/api/sites/${catalogue.siteId}/summary`, { token });

    expect(summary.status).toBe(200);
    expect(summary.body.siteCode).toBe('TEST-OBJ');
    expect(summary.body.equipmentTotal).toBe(1);
    expect(summary.body.requestsTotal).toBe(2);
    expect(summary.body.byStatus.new).toBe(2);
    expect(summary.body.byPriority.high).toBe(2);
  });

  it('сводка по несуществующей площадке даёт 404', async () => {
    const { token } = await login(server, viewer.email, PASSWORD);
    const response = await api(server, 'GET', '/api/sites/11111111-1111-4111-8111-111111111111/summary', {
      token,
    });

    expect(response.status).toBe(404);
  });

  it('нагрузка на оборудование фильтруется периодом и площадкой', async () => {
    const { token } = await login(server, admin.email, PASSWORD);
    await createRequest(token);

    const all = await api<{ data: unknown[]; applied: { limit: number } }>(
      server,
      'GET',
      '/api/reports/equipment-load',
      { token },
    );
    const forSite = await api<{ data: unknown[]; applied: { siteId?: string } }>(
      server,
      'GET',
      `/api/reports/equipment-load?siteId=${catalogue.siteId}&dateFrom=2026-01-01`,
      { token },
    );
    const outsidePeriod = await api<{ data: unknown[] }>(
      server,
      'GET',
      '/api/reports/equipment-load?dateFrom=2027-01-01',
      { token },
    );
    const brokenRange = await api<{ error: { code: string } }>(
      server,
      'GET',
      '/api/reports/equipment-load?dateFrom=2026-02-01&dateTo=2026-01-01',
      { token },
    );

    expect(all.status).toBe(200);
    expect(all.body.data.length).toBeGreaterThanOrEqual(1);
    expect(forSite.body.applied.siteId).toBe(catalogue.siteId);
    expect(outsidePeriod.body.data).toHaveLength(0);
    expect(brokenRange.status).toBe(422);
  });
});