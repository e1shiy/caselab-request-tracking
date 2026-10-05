import { randomUUID } from 'node:crypto';

import jwt from 'jsonwebtoken';

import { config } from '../config.js';
import type { AuthUser, StoredUser } from '../domain/user.js';
import { USER_ROLES } from '../domain/user.js';
import { UnauthorizedError } from '../errors.js';

const JWT_ALGORITHM = 'HS256' as const;
const ISSUER = 'caselab-request-tracking';

interface AccessTokenPayload extends jwt.JwtPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
  technicianId: string | null;
  kind: 'access';
}

interface RefreshTokenPayload extends jwt.JwtPayload {
  sub: string;
  jti: string;
  ver: number;
  kind: 'refresh';
}

export interface IssuedRefreshToken {
  token: string;
  recordId: string;
  expiresAt: Date;
}

export interface TokenPair {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: IssuedRefreshToken;
}

export function issueTokenPair(user: StoredUser, now: Date = new Date()): TokenPair {
  const accessToken = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.fullName,
      role: user.role,
      technicianId: user.technicianId,
      kind: 'access',
    },
    config.JWT_SECRET,
    {
      algorithm: JWT_ALGORITHM,
      expiresIn: config.ACCESS_TOKEN_TTL_SEC,
      issuer: ISSUER,
    },
  );

  const recordId = randomUUID();
  const refreshToken = jwt.sign(
    { sub: user.id, ver: user.tokenVersion, kind: 'refresh' },
    config.JWT_REFRESH_SECRET,
    {
      algorithm: JWT_ALGORITHM,
      expiresIn: config.REFRESH_TOKEN_TTL_SEC,
      issuer: ISSUER,
      jwtid: recordId,
    },
  );

  return {
    accessToken,
    accessTokenExpiresIn: config.ACCESS_TOKEN_TTL_SEC,
    refreshToken: {
      token: refreshToken,
      recordId,
      expiresAt: new Date(now.getTime() + config.REFRESH_TOKEN_TTL_SEC * 1000),
    },
  };
}

export function verifyAccessToken(token: string): AuthUser {
  const payload = verify<AccessTokenPayload>(token, config.JWT_SECRET);

  const valid =
    payload.kind === 'access' &&
    typeof payload.sub === 'string' &&
    typeof payload.email === 'string' &&
    typeof payload.name === 'string' &&
    typeof payload.role === 'string' &&
    USER_ROLES.includes(payload.role as AuthUser['role']);

  if (!valid) throw new UnauthorizedError('Токен доступа недействителен');

  return {
    id: payload.sub,
    email: payload.email,
    fullName: payload.name,
    role: payload.role as AuthUser['role'],
    technicianId: typeof payload.technicianId === 'string' ? payload.technicianId : null,
  };
}

export function verifyRefreshToken(token: string): { userId: string; recordId: string; version: number } {
  const payload = verify<RefreshTokenPayload>(token, config.JWT_REFRESH_SECRET);

  const valid =
    payload.kind === 'refresh' &&
    typeof payload.sub === 'string' &&
    typeof payload.jti === 'string' &&
    typeof payload.ver === 'number';

  if (!valid) throw new UnauthorizedError('Refresh-токен недействителен');

  return { userId: payload.sub, recordId: payload.jti, version: payload.ver };
}

function verify<T extends jwt.JwtPayload>(token: string, secret: string): T {
  try {
    return jwt.verify(token, secret, { algorithms: [JWT_ALGORITHM], issuer: ISSUER }) as T;
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    throw new UnauthorizedError('Токен недействителен или истёк', { cause: err });
  }
}