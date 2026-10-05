import { Router } from 'express';

import { createApp } from '../src/app.js';
import { config } from '../src/config.js';
import { openApiDocument } from '../src/docs/openapi.js';

/**
 * Сверяет спецификацию OpenAPI с реальными маршрутами Express.
 *
 * Проверяются оба направления:
 *   1. каждая описанная операция действительно существует (маршрут ищется
 *      проходом по стеку роутеров с проверкой mount-матчеров);
 *   2. каждый маршрут приложения описан в спецификации (относительный путь
 *      маршрута должен встречаться в конце какого-либо пути документа).
 *
 * Запуск: npm run docs:check
 */

interface RouteLayer {
  route?: { path: string | string[]; methods: unknown };
  handle?: { stack?: unknown[] };
  matchers?: ((path: string, options?: unknown) => boolean)[];
}

const HTTP_METHODS = ['get', 'post', 'patch', 'put', 'delete'] as const;

const stubStorage = {
  equipment: {},
  requests: {},
  reports: {},
  sites: {},
  users: {},
  transaction: async <T>(work: (storage: unknown) => Promise<T>): Promise<T> => work(stubStorage),
  health: async () => {},
  close: async () => {},
} as never;

const app = createApp(stubStorage);
// В Express 5 стек маршрутов лежит в app.router, а не в app._router.
const rootStack = (app as unknown as { router?: Router }).router?.stack;
if (!rootStack) {
  console.error('не удалось получить стек маршрутов Express');
  process.exit(1);
}

function asPath(path: string | string[]): string {
  return Array.isArray(path) ? path.join('/') : path;
}

function methodsOf(methods: unknown): string[] {
  if (Array.isArray(methods)) return methods as string[];
  if (typeof methods === 'string') return methods.split(',').map((method) => method.trim());
  if (methods && typeof methods === 'object') return Object.keys(methods);
  return [];
}

/**
 * Ищет операцию в стеке роутеров. Вложенные роутеры смонтированы на
 * относительных путях (`/requests` внутри `/api`), поэтому при спуске путь
 * укорачивается на префикс, который подошёл mount-матчеру.
 */
function hasOperation(stack: readonly unknown[], path: string, method: string): boolean {
  for (const raw of stack as RouteLayer[]) {
    const layer = raw as RouteLayer;

    if (layer.route) {
      if (methodsOf(layer.route.methods).includes(method) && matchesLiteral(path, asPath(layer.route.path))) {
        return true;
      }
      continue;
    }

    if (!layer.handle?.stack) continue;

    for (const prefix of candidatePrefixes(path)) {
      if (!accepts(layer, prefix)) continue;

      const rest = path.slice(prefix.length) || '/';
      if (hasOperation(layer.handle.stack, rest, method)) return true;
    }
  }

  return false;
}

/** Все префиксы пути по границам сегментов, от полного до пустого. */
function candidatePrefixes(path: string): string[] {
  const segments = path.split('/').filter(Boolean);
  const prefixes: string[] = [];

  for (let take = segments.length; take > 0; take--) {
    prefixes.push(`/${segments.slice(0, take).join('/')}`);
  }
  prefixes.push('');

  return prefixes;
}

function accepts(layer: RouteLayer, prefix: string): boolean {
  const matcher = layer.matchers?.[0];
  // app.use(fn) без пути — прозрачный слой, он ничего не отсекает.
  if (!matcher) return true;

  try {
    return Boolean(matcher(prefix, { end: false }));
  } catch {
    return false;
  }
}

/** Сравнивает шаблон маршрута с проверяемым путём: :id совпадает с одним сегментом. */
function matchesLiteral(path: string, routePath: string): boolean {
  const parts = path.split('/').filter(Boolean);
  const pattern = routePath.split('/').filter(Boolean);

  if (parts.length !== pattern.length) return false;

  return pattern.every((segment, index) => segment.startsWith(':') || segment === parts[index]);
}

/** Все относительные пути маршрутов приложения — без учёта префиксов. */
function collectRoutePaths(stack: readonly unknown[], found: Set<string>): void {
  for (const raw of stack as RouteLayer[]) {
    const layer = raw as RouteLayer;

    if (layer.route) found.add(asPath(layer.route.path) || '/');
    if (layer.handle?.stack) collectRoutePaths(layer.handle.stack, found);
  }
}

const documented: Array<{ method: string; path: string }> = [];
for (const [path, item] of Object.entries(openApiDocument.paths)) {
  for (const method of Object.keys(item)) {
    if ((HTTP_METHODS as readonly string[]).includes(method)) documented.push({ method, path });
  }
}

const missingInApp = documented
  .filter(({ method, path }) => !hasOperation(rootStack, path, method))
  .map(({ method, path }) => `${method.toUpperCase()} ${path}`);

const routePaths = new Set<string>();
collectRoutePaths(rootStack, routePaths);

// В спецификации параметры пути записаны как {id}, в Express — как :id.
const documentedSegments = Object.keys(openApiDocument.paths).map((path) =>
  path.replace(/\{(\w+)\}/g, ':$1').split('/').filter(Boolean),
);

function describedBySomePath(routePath: string): boolean {
  const routeSegments = routePath.split('/').filter(Boolean);
  return documentedSegments.some(
    (segments) =>
      segments.length >= routeSegments.length &&
      routeSegments.every((segment, index) => segment === segments[segments.length - routeSegments.length + index]),
  );
}

const missingInSpec = [...routePaths].filter((routePath) => !describedBySomePath(routePath)).sort();

// Служебные маршруты самого приложения: /metrics описан в спецификации отдельным
// путём, /openapi.json — это сама спецификация, её документ описывает косвенно.
const KNOWN_INTERNAL = new Set(['/metrics', '/openapi.json']);

if (missingInApp.length > 0 || missingInSpec.some((route) => !KNOWN_INTERNAL.has(route))) {
  if (missingInApp.length > 0) console.error('описано в OpenAPI, но нет в приложении:', missingInApp);
  const realMissing = missingInSpec.filter((route) => !KNOWN_INTERNAL.has(route));
  if (realMissing.length > 0) console.error('есть в приложении, но не описано:', realMissing);
  process.exit(1);
}

console.log(
  `OpenAPI: ${documented.length} операций совпадают с маршрутами приложения` +
    ` (${routePaths.size} шаблонов маршрутов). DOCS_ENABLED=${config.DOCS_ENABLED}`,
);