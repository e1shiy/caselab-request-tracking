import { literal, Op } from 'sequelize';

import { RefreshTokenModel } from '../../db/models/refresh-token.model.js';
import { UserModel } from '../../db/models/user.model.js';
import type { StoredUser } from '../../domain/user.js';
import type { Transaction } from '../common.js';
import { withDbErrorTranslation } from '../db-errors.js';
import type { NewUser, RefreshTokenRecord, UserRepository } from '../user-repository.js';
import { refreshTokenColumns, userColumns } from './attributes.js';
import { toRefreshToken, toUser } from './mappers.js';
import type { UserRow } from './mappers.js';

export class PostgresUserRepository implements UserRepository {
  async findByEmail(email: string): Promise<StoredUser | null> {
    const row = await UserModel.findOne({
      attributes: [...userColumns],
      where: { email },
      raw: true,
    });
    return row ? toUser(row as UserRow) : null;
  }

  async findById(id: string): Promise<StoredUser | null> {
    const row = await UserModel.findByPk(id, {
      attributes: [...userColumns],
      raw: true,
    });
    return row ? toUser(row as UserRow) : null;
  }

  async create(input: NewUser, passwordHash: string): Promise<StoredUser> {
    return withDbErrorTranslation(
      { unique: 'Пользователь с таким email уже зарегистрирован' },
      async () => {
        const row = await UserModel.create(
          {
            email: input.email,
            passwordHash,
            fullName: input.fullName,
            role: input.role,
            technicianId: input.technicianId ?? null,
            ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          },
          { raw: true },
        );
        return toUser(row as UserRow);
      },
    );
  }

  async bumpTokenVersion(id: string): Promise<number> {
    const [count] = await UserModel.update({ tokenVersion: literal('token_version + 1') }, { where: { id } });
    if (count === 0) return 0;

    const row = await UserModel.findByPk(id, { attributes: ['tokenVersion'], raw: true });
    return row ? Number((row as { tokenVersion: number }).tokenVersion) : 0;
  }

  async saveRefreshToken(record: RefreshTokenRecord, transaction?: Transaction): Promise<void> {
    await this.createRefreshToken(record, transaction);
  }

  async findRefreshToken(id: string): Promise<RefreshTokenRecord | null> {
    const row = await RefreshTokenModel.findByPk(id, {
      attributes: [...refreshTokenColumns],
      raw: true,
    });
    return row ? toRefreshToken(row) : null;
  }

  async rotateRefreshToken(
    previousId: string,
    next: RefreshTokenRecord,
    transaction?: Transaction,
  ): Promise<boolean> {
    return withDbErrorTranslation({}, async () => {
      const removed = await RefreshTokenModel.destroy({ where: { id: previousId }, transaction });
      if (removed === 0) return false;
      await this.createRefreshToken(next, transaction);
      return true;
    });
  }

  async revokeRefreshToken(id: string): Promise<boolean> {
    const removed = await RefreshTokenModel.destroy({ where: { id } });
    return removed > 0;
  }

  async revokeRefreshTokensOfUser(userId: string): Promise<number> {
    return RefreshTokenModel.destroy({ where: { userId } });
  }

  async purgeExpiredRefreshTokens(): Promise<number> {
    return RefreshTokenModel.destroy({ where: { expiresAt: { [Op.lt]: new Date() } } });
  }

  private async createRefreshToken(record: RefreshTokenRecord, transaction?: Transaction): Promise<void> {
    await RefreshTokenModel.create(
      {
        id: record.id,
        userId: record.userId,
        tokenVersion: record.tokenVersion,
        expiresAt: record.expiresAt,
      },
      { transaction },
    );
  }
}