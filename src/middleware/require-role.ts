import type { NextFunction, Request, Response } from 'express';

import type { AuthUser, UserRole } from '../domain/user.js';
import { ForbiddenError, UnauthorizedError } from '../errors.js';

export function requireRole(...allowed: readonly UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) {
      next(new UnauthorizedError());
      return;
    }

    if (!allowed.includes(user.role)) {
      next(new ForbiddenError(`Операция доступна ролям: ${allowed.join(', ')}`));
      return;
    }

    next();
  };
}

export function actorOf(req: Request): AuthUser {
  const user = req.user;
  if (!user) throw new UnauthorizedError();
  return user;
}