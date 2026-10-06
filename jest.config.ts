import type { Config } from 'jest';

// Jest 30 в ESM-режиме: приложение собрано как ESM с импортами вида './x.js',
// поэтому тесты компилируются тем же ts-jest, но с useESM и без
// расширения в маппинге. Node запускается с --experimental-vm-modules
// (см. npm-скрипты), иначе Jest не сможет исполнять ESM в воркерах.
const config: Config = {
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    // Исходники импортируют с расширением .js, которого в исходниках нет.
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: 'tsconfig.test.json',
        diagnostics: { warnOnly: false },
      },
    ],
  },
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  globalSetup: '<rootDir>/tests/global-setup.ts',
  setupFiles: ['<rootDir>/tests/setup-env.ts'],
  globalTeardown: '<rootDir>/tests/global-teardown.ts',
  // Тесты делят одну тестовую базу, поэтому воркер один: параллельные
  // процессы мешали бы друг другу truncate и общим фикстурам.
  maxWorkers: 1,
  testTimeout: 30_000,
  // Медленный первый запуск: bcrypt с 12 раундами в каждом наборе.
  slowTestThreshold: 10,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/db/migrations/**',
    '!src/db/cli/**',
    // Мигратор выполняется в globalSetup отдельным процессом tsx: его покрытие
    // не собирается, а работа проверяется самим фактом применения миграций.
    '!src/db/migrator.ts',
    '!src/types/**',
    '!src/**/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text-summary', 'lcov'],
  // Открытые соединения закрываем в afterAll, а не forceExit: иначе Jest
  // успевает напечатать отчёт и замаскировать утечки.
  forceExit: false,
  detectOpenHandles: false,
};

export default config;