import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

/**
 * Реестр метрик приложения. Идентификаторы ограничены значениями из
 * белых списков: путь маршрута и метод, идентификаторы из URL сюда не
 * попадают, иначе количество временных рядов росло бы с числом заявок.
 */
const registry = new Registry();

collectDefaultMetrics({ register: registry, prefix: 'app_' });

const requestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Количество обработанных запросов',
  labelNames: ['method', 'route', 'status'] as const,
  registers: [registry],
});

const requestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Длительность обработки запроса',
  labelNames: ['method', 'route', 'status'] as const,
  // 5 мс … 30 с: короткие ответы видны отдельно от долгих запросов к БД.
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
  registers: [registry],
});

const requestsInFlight = new Gauge({
  name: 'http_requests_in_flight',
  help: 'Количество запросов, которые обрабатываются прямо сейчас',
  registers: [registry],
});

const databaseUp = new Gauge({
  name: 'app_database_up',
  help: '1, если последняя проверка соединения с PostgreSQL успешна',
  registers: [registry],
});

databaseUp.set(0);

export interface RequestMetric {
  method: string;
  route: string;
  status: number;
  durationSeconds: number;
}

export function observeRequest(metric: RequestMetric): void {
  const labels = { method: metric.method, route: metric.route, status: String(metric.status) };

  requestsTotal.inc(labels);
  requestDuration.observe(labels, metric.durationSeconds);
}

export function requestStarted(): void {
  requestsInFlight.inc();
}

export function requestFinished(): void {
  requestsInFlight.dec();
}

export function setDatabaseUp(up: boolean): void {
  databaseUp.set(up ? 1 : 0);
}

export function metricsContentType(): string {
  return registry.contentType;
}

export async function renderMetrics(): Promise<string> {
  return registry.metrics();
}