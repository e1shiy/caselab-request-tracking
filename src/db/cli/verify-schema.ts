import { DataTypes, QueryTypes, type Model, type ModelStatic, type Sequelize } from 'sequelize';

import { logger } from '../../lib/logger.js';
import { createSequelize, waitForDatabase } from '../client.js';
import { initModels } from '../models/index.js';
import { ALL_ENUM_TYPES } from '../migrations/enum-types.js';

interface ColumnInfo {
  attname: string;
  type_name: string;
  type_sql: string;
  enum_values: string[] | null;
}

interface AttributeShape {
  type: string;
  isEnum: boolean;
  allowNull: boolean;
  primaryKey: boolean;
  enumValues: string[];
}

function columnName(field: string): string {
  return field;
}

function normalizeType(sql: string): string {
  return sql.toUpperCase().replace(/\s+/g, ' ').trim();
}

interface EnumAttributeType {
  values: string[];
}

function isEnumType(type: unknown): type is EnumAttributeType {
  return type instanceof DataTypes.ENUM;
}

function modelShape(model: ModelStatic<Model>): Map<string, AttributeShape> {
  const shape = new Map<string, AttributeShape>();
  for (const [key, attribute] of Object.entries(model.rawAttributes)) {
    if (!attribute) continue;
    const name = columnName(attribute.field ?? key);
    const attributeType = attribute.type;
    const isEnum = isEnumType(attributeType);
    shape.set(name, {
      type: isEnum
        ? 'USER-DEFINED'
        : normalizeType((attributeType as DataTypes.AbstractDataType).toSql()),
      isEnum,
      allowNull: attribute.allowNull !== false,
      primaryKey: attribute.primaryKey === true,
      enumValues: isEnum ? [...attributeType.values] : [],
    });
  }
  return shape;
}

interface DescribedColumn {
  allowNull?: boolean;
  primaryKey?: boolean;
}

async function tableColumns(sequelize: Sequelize, table: string): Promise<Map<string, ColumnInfo>> {
  const rows = await sequelize.query<ColumnInfo>(
    `SELECT a.attname AS "attname",
            t.typname AS "type_name",
            format_type(a.atttypid, a.atttypmod) AS "type_sql",
            (SELECT to_json(array_agg(e.enumlabel ORDER BY e.enumsortorder))
               FROM pg_enum e
              WHERE e.enumtypid = t.oid) AS "enum_values"
       FROM pg_attribute a
       JOIN pg_class c ON c.oid = a.attrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_type t ON t.oid = a.atttypid
      WHERE c.relname = :table
        AND n.nspname = 'public'
        AND a.attnum > 0
        AND NOT a.attisdropped`,
    { replacements: { table }, type: QueryTypes.SELECT },
  );
  return new Map(rows.map((row) => [row.attname, row]));
}

async function tableUniques(sequelize: Sequelize, table: string): Promise<string[]> {
  const rows = await sequelize.query<{ definition: string }>(
    `SELECT pg_get_constraintdef(con.oid) AS "definition"
       FROM pg_constraint con
       JOIN pg_class c ON c.oid = con.conrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = :table
        AND con.contype = 'u'`,
    { replacements: { table }, type: QueryTypes.SELECT },
  );
  return rows.map((row) => row.definition);
}

async function verifyEnumTypes(sequelize: Sequelize): Promise<string[]> {
  const problems: string[] = [];
  const rows = await sequelize.query<{ type_name: string; enum_values: string[] | null }>(
    `SELECT t.typname AS "type_name",
            (SELECT to_json(array_agg(e.enumlabel ORDER BY e.enumsortorder))
               FROM pg_enum e
              WHERE e.enumtypid = t.oid) AS "enum_values"
       FROM pg_type t
       JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
        AND t.typtype = 'e'`,
    { type: QueryTypes.SELECT },
  );
  const byName = new Map(rows.map((row) => [row.type_name, row.enum_values ?? []]));

  for (const { name, values } of ALL_ENUM_TYPES) {
    const actual = byName.get(name);
    if (!actual) {
      problems.push(`тип перечисления ${name} отсутствует в базе`);
      continue;
    }
    if (JSON.stringify([...actual].sort()) !== JSON.stringify([...values].sort())) {
      problems.push(
        `тип ${name}: значения в базе (${actual.join(', ')}) отличаются от доменных (${values.join(', ')})`,
      );
    }
  }
  for (const name of byName.keys()) {
    if (!ALL_ENUM_TYPES.some((type) => type.name === name)) {
      problems.push(`в базе есть незаявленный тип перечисления ${name}`);
    }
  }

  return problems;
}

export async function verifySchema(sequelize: Sequelize): Promise<string[]> {
  const problems: string[] = [...(await verifyEnumTypes(sequelize))];
  const models: ModelStatic<Model>[] = Object.values(sequelize.models);

  for (const model of models) {
    const table = model.getTableName() as string;
    const columns = await tableColumns(sequelize, table);
    const expected = modelShape(model);
    const described = (await sequelize.getQueryInterface().describeTable(table, {
      schema: 'public',
    })) as Record<string, DescribedColumn>;

    for (const [name, shape] of expected) {
      const actual = columns.get(name);
      if (!actual) {
        problems.push(`${table}.${name}: колонка описана в модели, но отсутствует в базе`);
        continue;
      }

      const actualType =
        actual.enum_values === null ? normalizeType(actual.type_sql) : 'USER-DEFINED';
      if (actualType !== shape.type) {
        problems.push(`${table}.${name}: тип в базе ${actual.type_name}, в модели ${shape.type}`);
      }

      if (shape.isEnum) {
        if (actual.enum_values === null) {
          problems.push(`${table}.${name}: в модели перечисление, в базе обычный тип ${actual.type_name}`);
        } else if (
          JSON.stringify([...actual.enum_values].sort()) !== JSON.stringify([...shape.enumValues].sort())
        ) {
          problems.push(
            `${table}.${name}: значения перечисления расходятся (база: ${actual.enum_values.join(', ')}; модель: ${shape.enumValues.join(', ')})`,
          );
        }
      }

      const describedColumn = described[name];
      if (describedColumn) {
        if ((describedColumn.primaryKey ?? false) !== shape.primaryKey) {
          problems.push(
            `${table}.${name}: первичный ключ в модели (${shape.primaryKey}) и в базе (${describedColumn.primaryKey ?? false}) не совпадает`,
          );
        }
        const dbAllowNull = describedColumn.allowNull ?? true;
        if (dbAllowNull !== shape.allowNull) {
          problems.push(
            `${table}.${name}: allowNull в модели ${shape.allowNull}, в базе ${dbAllowNull}`,
          );
        }
      }
    }

    for (const name of columns.keys()) {
      if (!expected.has(name)) {
        problems.push(`${table}.${name}: колонка есть в базе, но не описана в модели`);
      }
    }

    const modelUniques = Object.entries(model.rawAttributes)
      .filter(([, attribute]) => attribute?.unique === true)
      .map(([key, attribute]) => columnName(attribute?.field ?? key))
      .sort();
    const dbUniques = (await tableUniques(sequelize, table))
      .map((definition) => definition.replace(/^UNIQUE\s*\(/i, '').replace(/\)$/, ''))
      .map((list) =>
        list
          .split(',')
          .map((column) => column.trim())
          .sort()
          .join(','),
      );

    for (const unique of modelUniques) {
      if (!dbUniques.includes(unique)) {
        problems.push(`${table}: уникальное ограничение модели (${unique}) не найдено в базе`);
      }
    }
    for (const unique of dbUniques) {
      if (!modelUniques.includes(unique)) {
        problems.push(`${table}: уникальное ограничение ${unique} есть в базе, но не описано в модели`);
      }
    }
  }

  return problems;
}

async function main(): Promise<void> {
  const sequelize = createSequelize('app');
  try {
    await waitForDatabase(sequelize);
    initModels(sequelize);
    const problems = await verifySchema(sequelize);
    if (problems.length > 0) {
      for (const problem of problems) {
        logger.error({ problem }, 'модель не совпадает со схемой');
      }
      process.exitCode = 1;
      return;
    }
    logger.info({ tables: Object.keys(sequelize.models).length }, 'модели совпадают со схемой');
  } finally {
    await sequelize.close();
  }
}

await main();
