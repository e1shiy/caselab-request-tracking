import type { AuthUser } from './domain/user.js';

declare global {
  namespace Express {
    interface Request {
      valid: {
        body?: unknown;
        query?: unknown;
        params?: unknown;
      };
      user?: AuthUser;
    }
  }
}

export {};