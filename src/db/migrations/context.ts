import type { QueryInterface } from 'sequelize';

export interface DbContext {
  queryInterface: QueryInterface;
}
