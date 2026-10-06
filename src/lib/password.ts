import { randomBytes } from 'node:crypto';

import bcrypt from 'bcrypt';

import { config } from '../config.js';

// Хеш пароля, которого нет ни у одной учётной записи. Сравнение с ним занимает
// столько же времени, сколько проверка настоящего хеша, поэтому по времени
// ответа нельзя понять, существует ли аккаунт с таким email. Считается лениво
// и один раз, чтобы стоимость совпадала с BCRYPT_ROUNDS.
let equalizingHash: Promise<string> | null = null;

function getEqualizingHash(): Promise<string> {
  if (equalizingHash === null) {
    equalizingHash = bcrypt.hash(randomBytes(32).toString('base64'), config.BCRYPT_ROUNDS);
  }
  return equalizingHash;
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, config.BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(plain, passwordHash);
}

export function equalizeTiming(plain: string, passwordHash: string | null): Promise<boolean> {
  if (passwordHash !== null) return bcrypt.compare(plain, passwordHash);
  return getEqualizingHash().then((hash) => bcrypt.compare(plain, hash));
}