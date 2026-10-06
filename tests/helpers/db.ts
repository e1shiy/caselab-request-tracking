import { QueryTypes, Sequelize } from 'sequelize';

import { config } from '../../src/config.js';

// Таблицы перечислены явно, а не через information_schema: TRUNCATE требует
// прав владельца, а лишние имена из information_schema (views, служебные) в
// списке только мешают. Порядок не важен — CASCADE снимает зависимости.
const TABLES = [
  'request_status_history',
  'request_assignees',
  'maintenance_requests',
  'equipment_passports',
  'equipment',
  'sites',
  'technicians',
  'refresh_tokens',
  'users',
] as const;

let migrationConnection: Sequelize | undefined;

function migrationSequelize(): Sequelize {
  // TRUNCATE требует прав владельца таблиц, а они у роли миграций: роль
  // приложения может только DML (см. grant-app-role-privileges).
  migrationConnection ??= new Sequelize({
    dialect: 'postgres',
    host: config.DB_HOST,
    port: config.DB_PORT,
    database: config.DB_NAME,
    username: config.DB_MIGRATION_USER,
    password: config.DB_MIGRATION_PASSWORD,
    logging: false,
  });
  return migrationConnection;
}

/** Чистит все таблицы тестовой базы: каждый набор стартует с нуля. */
export async function truncateAll(): Promise<void> {
  const list = TABLES.map((table) => `"${table}"`).join(', ');
  await migrationSequelize().query(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

export async function closeDatabase(): Promise<void> {
  await migrationConnection?.close();
  migrationConnection = undefined;
}

export interface SeededUser {
  id: string;
  email: string;
  role: 'admin' | 'technician' | 'viewer';
  technicianId: string | null;
  password: string;
}

/** Создаёт пользователя сразу с паролем — bcrypt считается один раз в хуке. */
export async function insertUser(input: {
  email: string;
  fullName: string;
  role: SeededUser['role'];
  password: string;
  technicianId?: string | null;
  isActive?: boolean;
}): Promise<SeededUser> {
  const { hashPassword } = await import('../../src/lib/password.js');
  const sequelize = migrationSequelize();
  const rows = await sequelize.query<{ id: string }>(
    `INSERT INTO users (email, password_hash, full_name, role, technician_id, is_active)
     VALUES (:email, :passwordHash, :fullName, :role, :technicianId, :isActive)
     RETURNING id`,
    {
      type: QueryTypes.SELECT,
      replacements: {
        email: input.email,
        passwordHash: await hashPassword(input.password),
        fullName: input.fullName,
        role: input.role,
        technicianId: input.technicianId ?? null,
        isActive: input.isActive ?? true,
      },
    },
  );
  const id = rows[0]?.id;
  if (id === undefined) throw new Error('пользователь не создан');
  return {
    id,
    email: input.email,
    role: input.role,
    technicianId: input.technicianId ?? null,
    password: input.password,
  };
}

export interface SeededCatalogue {
  siteId: string;
  equipmentId: string;
  technicianIds: string[];
}

/** Площадка, два техника и одно оборудование — базовый мир для наборов. */
export async function seedCatalogue(): Promise<SeededCatalogue> {
  const sequelize = migrationSequelize();

  const sites = await sequelize.query<{ id: string }>(
    `INSERT INTO sites (name, code, region, latitude, longitude)
     VALUES ('Тестовый объект', 'TEST-OBJ', 'Тестовый регион', 55.75, 37.62)
     RETURNING id`,
    { type: QueryTypes.SELECT },
  );
  const siteId = sites[0]?.id;
  if (siteId === undefined) throw new Error('площадка не создана');

  const technicianIds: string[] = [];
  for (const [index, name] of ['Первый техник', 'Второй техник'].entries()) {
    const rows = await sequelize.query<{ id: string }>(
      `INSERT INTO technicians (full_name, specialization, personnel_number)
       VALUES (:name, :specialization, :personnelNumber)
       RETURNING id`,
      {
        type: QueryTypes.SELECT,
        replacements: {
          name,
          specialization: index === 0 ? 'Компрессорное оборудование' : 'Электрооборудование',
          personnelNumber: `TEST-PN-${index}`,
        },
      },
    );
    const technicianId = rows[0]?.id;
    if (technicianId === undefined) throw new Error('техник не создан');
    technicianIds.push(technicianId);
  }

  const equipment = await sequelize.query<{ id: string }>(
    `INSERT INTO equipment (site_id, name, type, serial_number, latitude, longitude,
                             status, installed_at)
     VALUES (:siteId, 'Инвертор', 'inverter', :serial, :latitude, :longitude,
             'operational', DATE '2024-01-15')
     RETURNING id`,
    {
      type: QueryTypes.SELECT,
      replacements: {
        siteId,
        serial: 'TEST-COMP-0001',
        latitude: 55.75,
        longitude: 37.62,
      },
    },
  );

  const equipmentId = equipment[0]?.id;
  if (equipmentId === undefined) throw new Error('оборудование не создано');

  return { siteId, equipmentId, technicianIds };
}