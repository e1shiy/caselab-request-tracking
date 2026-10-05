import type { CookieOptions } from 'express';

import { config } from '../config.js';

export interface RefreshCookieOptions extends CookieOptions {
  maxAge: number;
}

export function refreshCookieOptions(): RefreshCookieOptions {
  const secure = config.REFRESH_COOKIE_SECURE ?? config.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure,
    sameSite: config.COOKIE_SAME_SITE,
    path: '/api/auth',
    maxAge: config.REFRESH_TOKEN_TTL_SEC * 1000,
  };
}