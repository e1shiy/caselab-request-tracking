import type { Request } from 'express';

import type { AuthUser, StoredUser } from '../domain/user.js';
import { UnauthorizedError } from '../errors.js';
import { getLog } from '../lib/context.js';
import { equalizeTiming, hashPassword, verifyPassword } from '../lib/password.js';
import { issueTokenPair, verifyRefreshToken } from '../lib/token-service.js';
import type { TokenPair } from '../lib/token-service.js';
import type { TransactionRunner } from '../repositories/common.js';
import type { RefreshTokenRecord, UserRepository } from '../repositories/user-repository.js';

const INVALID_CREDENTIALS = 'Неверный email или пароль';

export interface LoginContext {
  ip: string | null;
  userAgent: string | null;
}

export interface AuthResult {
  user: AuthUser;
  tokens: TokenPair;
}

export class AuthService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly runInTransaction: TransactionRunner,
  ) {}

  async register(email: string, password: string, fullName: string): Promise<AuthResult> {
    const stored = await this.userRepo.create(
      { email: normalizeEmail(email), fullName, role: 'viewer' },
      await hashPassword(password),
    );

    getLog().info({ userId: stored.id, role: stored.role }, 'пользователь зарегистрирован');

    const tokens = issueTokenPair(stored);
    await this.userRepo.saveRefreshToken(this.toRecord(tokens.refreshToken, stored));

    return { user: toAuthUser(stored), tokens };
  }

  async login(email: string, password: string, context: LoginContext): Promise<AuthResult> {
    const log = getLog();
    const stored = await this.userRepo.findByEmail(normalizeEmail(email));

    const passwordMatches = await (stored === null
      ? equalizeTiming(password, null)
      : verifyPassword(password, stored.passwordHash));

    if (stored === null || !passwordMatches) {
      log.warn(
        { email: normalizeEmail(email), ip: context.ip, userAgent: context.userAgent },
        'неудачная попытка входа',
      );
      throw new UnauthorizedError(INVALID_CREDENTIALS);
    }

    if (!stored.isActive) {
      log.warn({ userId: stored.id, ip: context.ip }, 'вход заблокированной учётной записи');
      throw new UnauthorizedError('Учётная запись отключена');
    }

    log.info({ userId: stored.id, role: stored.role, ip: context.ip }, 'вход выполнен');

    const tokens = issueTokenPair(stored);
    await this.userRepo.saveRefreshToken(this.toRecord(tokens.refreshToken, stored));

    return { user: toAuthUser(stored), tokens };
  }

  async refresh(token: string): Promise<AuthResult> {
    const log = getLog();
    const claims = verifyRefreshToken(token);

    const stored = await this.userRepo.findById(claims.userId);
    if (!stored || !stored.isActive) {
      throw new UnauthorizedError('Учётная запись не найдена или отключена');
    }

    const record = await this.userRepo.findRefreshToken(claims.recordId);
    const usable =
      record !== null &&
      record.tokenVersion === stored.tokenVersion &&
      claims.version === stored.tokenVersion;

    if (!usable) {
      // Токен уже использован или отозван: считаем попытку повторного
      // использования и закрываем все сессии пользователя.
      log.warn({ userId: stored.id, recordId: claims.recordId }, 'повторное использование refresh-токена');
      await this.revokeAllSessions(stored.id);
      throw new UnauthorizedError('Сессия недействительна, войдите заново');
    }

    const tokens = issueTokenPair(stored);
    const rotated = await this.runInTransaction((transaction) =>
      this.userRepo.rotateRefreshToken(claims.recordId, this.toRecord(tokens.refreshToken, stored), transaction),
    );

    if (!rotated) {
      log.warn({ userId: stored.id, recordId: claims.recordId }, 'refresh-токен не удалось заменить');
      await this.revokeAllSessions(stored.id);
      throw new UnauthorizedError('Сессия недействительна, войдите заново');
    }

    return { user: toAuthUser(stored), tokens };
  }

  // Выход идемпотентен: истёкший или уже отозванный токен не должен мешать
  // клиенту закрыть сессию и почистить cookie.
  async logout(token: string | undefined): Promise<void> {
    if (token === undefined) return;

    try {
      const claims = verifyRefreshToken(token);
      await this.userRepo.revokeRefreshToken(claims.recordId);
      getLog().info({ userId: claims.userId }, 'сессия завершена');
    } catch (err) {
      if (!(err instanceof UnauthorizedError)) throw err;
      getLog().info('сессия уже недействительна');
    }
  }

  async me(userId: string): Promise<AuthUser> {
    const stored = await this.userRepo.findById(userId);
    if (!stored) throw new UnauthorizedError('Учётная запись не найдена');
    return toAuthUser(stored);
  }

  private async revokeAllSessions(userId: string): Promise<void> {
    await this.userRepo.revokeRefreshTokensOfUser(userId);
    await this.userRepo.bumpTokenVersion(userId);
  }

  private toRecord(
    refresh: { token: string; recordId: string; expiresAt: Date },
    user: StoredUser,
  ): RefreshTokenRecord {
    return {
      id: refresh.recordId,
      userId: user.id,
      tokenVersion: user.tokenVersion,
      expiresAt: refresh.expiresAt,
    };
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function toAuthUser(user: StoredUser): AuthUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    technicianId: user.technicianId,
  };
}

export function loginContextFrom(req: Request): LoginContext {
  const userAgent = req.get('user-agent');
  return { ip: req.ip ?? null, userAgent: userAgent === undefined ? null : userAgent };
}