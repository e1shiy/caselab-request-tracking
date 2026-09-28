import type { Transaction } from 'sequelize';

import type { Sort } from '../schemas/common.js';

export type { Transaction };

export interface Page<T> {
  rows: T[];
  total: number;
}

export interface ListParams {
  page: number;
  limit: number;
  sort?: Sort;
}

export interface Pagination {
  offset: number;
  limit: number;
}

export function pagination(page: number, limit: number): Pagination {
  return { offset: (page - 1) * limit, limit };
}
