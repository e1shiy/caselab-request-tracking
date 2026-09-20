import { AsyncLocalStorage } from 'node:async_hooks';

import type { NextFunction, Request, Response } from 'express';
import type { Logger } from 'pino';

import { logger } from './logger.js';

interface RequestContext {
  reqId: string;
  log: Logger;
}

export const store = new AsyncLocalStorage<RequestContext>();

export function contextMiddleware(req: Request, _res: Response, next: NextFunction): void {
  store.run({ reqId: String(req.id), log: req.log }, () => next());
}

export function getLog(): Logger {
  return store.getStore()?.log ?? logger;
}