// Подготовка окружения для тестов. Файл выполняется до импорта тестов и
// модулей приложения, поэтому переопределения здесь важнее .env: dotenv не
// перезаписывает уже установленные переменные.
//
// Значения присваиваются явно, а не через ??: процесс Jest наследует
// process.env от globalSetup, который уже загрузил .env, поэтому «мягкое»
// переопределение оставило бы боевые лимиты и тесты падали бы с 429.

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = process.env.TEST_LOG_LEVEL ?? 'fatal';

// Тесты работают с отдельной базой: общая рабочая остаётся нетронутой, а
// падение suite не оставляет мусор в рабочих данных.
process.env.TEST_DB_NAME = process.env.TEST_DB_NAME ?? 'appdb_test';
process.env.DB_NAME = process.env.TEST_DB_NAME;

// Секреты — фиксированные, иначе токены разных прогонов не совпали бы.
process.env.JWT_SECRET = 'test-secret-access-0123456789abcdef0123456789abcdef';
process.env.JWT_REFRESH_SECRET = 'test-secret-refresh-0123456789abcdef0123456789abcdef';

// bcrypt с 8 раундами — минимум, который принимает config: тесты не проверяют
// стойкость хеша, а 12 боевых раундов на каждом наборе добавляют минуты.
process.env.BCRYPT_ROUNDS = '8';

// Лимиты частоты в тестах мешают: проверка 429 отдельно идёт с подменой
// счётчика, а весь остальной набор превысил бы квоту.
process.env.RATE_LIMIT_MAX = '100000';
process.env.LOGIN_RATE_LIMIT_MAX = '100000';

// За nginx в тестах ничего нет, доверять нечего.
process.env.TRUST_PROXY_HOPS = '0';
process.env.REFRESH_COOKIE_SECURE = 'false';
process.env.SEED_USERS = 'false';
process.env.DB_LOG_QUERIES = 'false';

// Погодный сервис в тестах подменяется локальным стабом: адрес переопределит
// helpers/weather.ts, который поднимает сервер на 127.0.0.1.
process.env.WEATHER_API_URL = 'http://127.0.0.1:1/unused';