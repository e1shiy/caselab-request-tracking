import type { Request, Response } from 'express';

import { config } from '../config.js';
import { asyncHandler } from '../lib/async-handler.js';
import { refreshCookieOptions } from '../lib/refresh-cookie.js';
import { actorOf } from '../middleware/require-role.js';
import type { AuthUser } from '../domain/user.js';
import type { LoginInput, RegisterInput } from '../schemas/auth.js';
import type { AuthService } from '../services/auth-service.js';
import { loginContextFrom } from '../services/auth-service.js';

interface TokenResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: AuthUser;
}

export class AuthController {
  constructor(private readonly service: AuthService) {}

  register = asyncHandler(async (req, res) => {
    const body = req.valid.body as RegisterInput;
    const result = await this.service.register(body.email, body.password, body.fullName);

    setRefreshCookie(res, result.tokens.refreshToken.token);
    res.status(201).json(tokenResponse(result.user, result.tokens.accessToken, result.tokens.accessTokenExpiresIn));
  });

  login = asyncHandler(async (req, res) => {
    const body = req.valid.body as LoginInput;
    const result = await this.service.login(body.email, body.password, loginContextFrom(req));

    setRefreshCookie(res, result.tokens.refreshToken.token);
    res.json(tokenResponse(result.user, result.tokens.accessToken, result.tokens.accessTokenExpiresIn));
  });

  refresh = asyncHandler(async (req, res) => {
    const result = await this.service.refresh(readRefreshCookie(req));

    setRefreshCookie(res, result.tokens.refreshToken.token);
    res.json(tokenResponse(result.user, result.tokens.accessToken, result.tokens.accessTokenExpiresIn));
  });

  logout = asyncHandler(async (req, res) => {
    await this.service.logout(readRefreshCookie(req));
    res.clearCookie(config.REFRESH_COOKIE_NAME, refreshCookieOptions());
    res.status(204).send();
  });

  me = asyncHandler(async (req, res) => {
    res.json(await this.service.me(actorOf(req).id));
  });
}

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(config.REFRESH_COOKIE_NAME, token, refreshCookieOptions());
}

function readRefreshCookie(req: Request): string {
  const cookies = req.cookies as Record<string, unknown> | undefined;
  const value = cookies?.[config.REFRESH_COOKIE_NAME];
  return typeof value === 'string' ? value : '';
}

function tokenResponse(user: AuthUser, accessToken: string, expiresIn: number): TokenResponse {
  return { accessToken, tokenType: 'Bearer', expiresIn, user };
}