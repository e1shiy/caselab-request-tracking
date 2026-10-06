import type { StoredUser, UserRole } from '../domain/user.js';
import type { Transaction } from './common.js';

export interface NewUser {
  email: string;
  fullName: string;
  role: UserRole;
  technicianId?: string | null;
  isActive?: boolean;
}

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  tokenVersion: number;
  expiresAt: Date;
}

export interface UserRepository {
  findByEmail(email: string): Promise<StoredUser | null>;
  findById(id: string): Promise<StoredUser | null>;
  create(input: NewUser, passwordHash: string): Promise<StoredUser>;
  bumpTokenVersion(id: string): Promise<number>;

  saveRefreshToken(record: RefreshTokenRecord, transaction?: Transaction): Promise<void>;
  findRefreshToken(id: string): Promise<RefreshTokenRecord | null>;
  rotateRefreshToken(
    previousId: string,
    next: RefreshTokenRecord,
    transaction?: Transaction,
  ): Promise<boolean>;
  revokeRefreshToken(id: string): Promise<boolean>;
  revokeRefreshTokensOfUser(userId: string): Promise<number>;
  purgeExpiredRefreshTokens(): Promise<number>;
}