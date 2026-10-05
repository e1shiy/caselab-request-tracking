import type { NextFunction, Request, Response } from 'express';

import { UnauthorizedError } from '../errors.js';
import { verifyAccessToken } from '../lib/token-service.js';

const BEARER_PREFIX = 'Bearer ';

export function bearerToken(header: string | undefined): string {
  if (header === undefined || !header.startsWith(BEARER_PREFIX)) return '';
  return header.slice(BEARER_PREFIX.length).trim();
}

export function authenticate() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const token = bearerToken(req.get('authorization'));
    if (token === '') {
      next(new UnauthorizedError('Токен доступа не передан'));
      return;
    }

    req.user = verifyAccessToken(token);
    next();
  };
}