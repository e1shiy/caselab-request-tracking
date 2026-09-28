import type { Transaction } from 'sequelize';

import type { Sort } from '../schemas/common.js';

export type { Transaction };

export type TransactionRunner = <T>(action: (transaction: Transaction) => Promise<T>) => Promise<T>;

export interface Page<T> {
  rows: T[];
  total: number;
}

export interface ListParams {
  page: number;
  limit: number;
  offset?: number;
  sort?: Sort;
}

export interface Pagination {
  offset: number;
  limit: number;
}

export function pagination(page: number, limit: number, offset?: number): Pagination {
  return { offset: offset ?? (page - 1) * limit, limit };
}
