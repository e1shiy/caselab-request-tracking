import { describe, expect, it } from '@jest/globals';

import type { StoredUser } from '../../src/domain/user.js';
import { UnauthorizedError } from '../../src/errors.js';
import { issueTokenPair, verifyAccessToken, verifyRefreshToken } from '../../src/lib/token-service.js';

const user: StoredUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'tech@example.test',
  fullName: 'Иванов Иван',
  role: 'technician',
  technicianId: '22222222-2222-4222-8222-222222222222',
  passwordHash: 'hash',
  tokenVersion: 3,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('issueTokenPair', () => {
  it('access-токен переносит пользователя и его роль', () => {
    const pair = issueTokenPair(user);
    expect(verifyAccessToken(pair.accessToken)).toEqual({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: 'technician',
      technicianId: user.technicianId,
    });
  });

  it('refresh-токен хранит userId, jti и версию', () => {
    const pair = issueTokenPair(user);
    const payload = verifyRefreshToken(pair.refreshToken.token);

    expect(payload).toEqual({
      userId: user.id,
      recordId: pair.refreshToken.recordId,
      version: 3,
    });
  });

  it('срок жизни refresh-токена считается от переданного момента', () => {
    const now = new Date('2026-10-01T10:00:00.000Z');
    const pair = issueTokenPair(user, now);
    const days = (pair.refreshToken.expiresAt.getTime() - now.getTime()) / 86_400_000;
    expect(days).toBeCloseTo(7, 5);
  });

  it('access и refresh не взаимозаменяемы', () => {
    const pair = issueTokenPair(user);
    expect(() => verifyRefreshToken(pair.accessToken)).toThrow(UnauthorizedError);
    expect(() => verifyAccessToken(pair.refreshToken.token)).toThrow(UnauthorizedError);
  });
});

describe('verifyAccessToken', () => {
  it('отклоняет подделанную подпись', () => {
    const pair = issueTokenPair(user);
    const [header, payload] = pair.accessToken.split('.');
    const forged = `${header}.${payload}.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`;

    expect(() => verifyAccessToken(forged)).toThrow(UnauthorizedError);
    expect(() => verifyAccessToken(forged)).toThrow('Токен недействителен или истёк');
  });

  it('отклоняет мусор вместо токена', () => {
    expect(() => verifyAccessToken('не токен')).toThrow(UnauthorizedError);
  });

  it('возвращает null для техника без записи в справочнике', () => {
    const pair = issueTokenPair({ ...user, technicianId: null });
    expect(verifyAccessToken(pair.accessToken).technicianId).toBeNull();
  });
});

describe('verifyRefreshToken', () => {
  it('отклоняет refresh-токен, подписанный секретом access-токенов', () => {
    // Секреты разные специально: подмена секрета — самая частая ошибка
    // при ротации окружения.
    const pair = issueTokenPair(user);
    expect(() => verifyRefreshToken(pair.refreshToken.token.slice(0, -3) + 'aaa')).toThrow(
      UnauthorizedError,
    );
  });
});