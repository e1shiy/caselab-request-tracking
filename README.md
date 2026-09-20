# Сервис учёта заявок на обслуживание оборудования

REST API на Express для учёта заявок на техническое обслуживание оборудования
производственной площадки (ветропарка). Сервис:

- ведёт справочник оборудования и заявки на его обслуживание;
- контролирует жизненный цикл заявки по таблице допустимых переходов статусов;
- позволяет оценить погодные условия на объекте и пригодность «окна» для
  наружных работ (модуль из Кейса 1, внешний API open-meteo).

Данные хранятся в JSON-файлах (`data/`) и доступны исключительно через слой
репозиториев, поэтому на Неделе 3 источник данных можно заменить на PostgreSQL
(Sequelize) без изменений в сервисах и контроллерах.

## Требования к окружению

- Node.js ≥ 18 (используются глобальные `fetch` и `AbortSignal.timeout`);
- npm.

## Установка и запуск

```bash
npm install

# переменные окружения (опционально, есть значения по умолчанию)
cp .env.example .env

# разработка — tsx watch с перезапуском
npm run dev

# сборка и запуск из dist
npm run build
npm start

# проверка типов
npm run typecheck
```

Сервер по умолчанию поднимается на `0.0.0.0:3000`. Проверка доступности:
`GET /api/health` → `{"status":"ok"}`.

## Переменные окружения

| Переменная | По умолчанию | Описание |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development` \| `test` \| `production` |
| `HOST` | `0.0.0.0` | Адрес привязки |
| `PORT` | `3000` | Порт |
| `LOG_LEVEL` | `info` | `fatal` \| `error` \| `warn` \| `info` \| `debug` \| `trace` |
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:8080` | Список разрешённых источников через запятую |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Окно ограничения частоты запросов (мс) |
| `RATE_LIMIT_MAX` | `100` | Максимум запросов в окне |
| `BODY_LIMIT` | `100kb` | Максимальный размер тела запроса |
| `WEATHER_API_URL` | `https://api.open-meteo.com/v1/forecast` | Базовый URL погодного API |
| `REQUEST_TIMEOUT_MS` | `5000` | Таймаут обращения к погодному API (мс) |
| `WEATHER_FORECAST_DAYS` | `5` | Число дней прогноза (1–16) |
| `WEATHER_MAX_WIND_MS` | `15` | Порог максимальной скорости ветра, «км/ч» |
| `WEATHER_ALLOWED_PRECIPITATION_MM` | `0` | Допустимое количество осадков за день, «мм» |
| `DATA_DIR` | `./data` | Каталог JSON-файлов хранилища |

## Модель данных

### Оборудование (`equipment`)

| Поле | Тип | Правила |
| --- | --- | --- |
| `id` | string (uuid) | генерируется сервером, не изменяемо |
| `name` | string | 3–100 символов, обязательное |
| `type` | enum | `turbine` \| `inverter` \| `sensor` \| `substation` |
| `serialNumber` | string | уникально в пределах системы |
| `location` | object | `{ lat, lon }` — широта/долгота |
| `status` | enum | `operational` \| `maintenance` \| `fault` \| `decommissioned` (по умолчанию `operational`) |
| `installedAt` | string (ISO-дата) | не может быть в будущем |
| `createdAt` / `updatedAt` | string (ISO) | проставляются сервером, не изменяемы |

### Заявка на обслуживание (`request`)

| Поле | Тип | Правила |
| --- | --- | --- |
| `id` | string (uuid) | генерируется сервером, не изменяемо |
| `equipmentId` | string (uuid) | ссылка на существующее оборудование |
| `title` | string | 5–120 символов, обязательное |
| `description` | string | до 2000 символов |
| `priority` | enum | `low` \| `medium` \| `high` \| `critical` (по умолчанию `medium`) |
| `status` | enum | `new` \| `in_progress` \| `done` \| `rejected` (по умолчанию `new`) |
| `plannedAt` | string (ISO datetime) | необязательное, можно очистить (`null`) |
| `createdAt` / `updatedAt` | string (ISO) | проставляются сервером, не изменяемы |

### Схема переходов статусов заявки

```
new ──────────► in_progress ──────────► done
 │                  │
 │                  ▼
 └──────────────► rejected
```

- `new → in_progress`, `new → rejected`, `in_progress → done`, `in_progress → rejected`;
- из `done` и `rejected` переходы запрещены; попытка — ответ **409**;
- повторная установка текущего статуса — ответ **409**.

## Эндпоинты

| Метод | Путь | Назначение | Коды |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Проверка доступности | 200 |
| `GET` | `/api/equipment` | Список: фильтры `status`, `type`, сортировка `sort`, пагинация `page`, `limit` | 200 |
| `POST` | `/api/equipment` | Создание оборудования | 201, 409, 422 |
| `GET` | `/api/equipment/:id` | Карточка | 200, 404 |
| `PATCH` | `/api/equipment/:id` | Частичное обновление | 200, 404, 409, 422 |
| `DELETE` | `/api/equipment/:id` | Удаление (запрещено при открытых заявках) | 204, 404, 409 |
| `GET` | `/api/equipment/:id/requests` | Заявки по оборудованию (те же фильтры) | 200, 404, 422 |
| `GET` | `/api/equipment/:id/weather` | Прогноз и пригодность окна | 200, 404, 502 |
| `GET` | `/api/requests` | Список: фильтры `status`, `priority`, `equipmentId`, `dateFrom`/`dateTo` (по `createdAt`), `sort`, `page`, `limit` | 200, 422 |
| `POST` | `/api/requests` | Создание заявки | 201, 404, 422 |
| `GET` | `/api/requests/:id` | Карточка заявки | 200, 404 |
| `PATCH` | `/api/requests/:id` | Редактирование полей (`title`, `description`, `priority`, `plannedAt`) | 200, 404, 422 |
| `PATCH` | `/api/requests/:id/status` | Смена статуса с проверкой перехода | 200, 404, 409, 422 |
| `DELETE` | `/api/requests/:id` | Удаление заявки | 204, 404 |

> Во всех списках ответ имеет вид `{ data: [...], meta: { total, page, limit } }`.
> Одиночные ресурсы возвращаются объектом напрямую. У любого изменения —
> `Location`-заголовок (при 201) и консистентный `updatedAt`.

### Сортировка и пагинация

- `sort=name` — по возрастанию, `sort=-name` — по убыванию. Поля сортировки для
  оборудования: `name`, `type`, `status`, `serialNumber`, `installedAt`, `createdAt`;
  для заявок: `priority`, `status`, `plannedAt`, `createdAt`, `updatedAt`. Неизвестное
  поле — `422`.
- `page` (≥1, по умолчанию 1), `limit` (1–100, по умолчанию 20).

## Формат ответа об ошибке

Все ошибки возвращаются в едином формате:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Некорректные данные запроса",
    "details": [
      { "field": "priority", "message": "Недопустимый приоритет" }
    ],
    "requestId": "b1f2c3d4-..."
  }
}
```

`details` присутствует только у ошибок валидации. `requestId` совпадает с заголовком
`X-Request-Id` ответа и с идентификатором запроса в логах — по нему можно найти
запись в логах. В `production` у ответов 5xx скрываются внутренние сообщения и
стек-трейсы.

Коды ошибок:

| Код | HTTP | Когда |
| --- | --- | --- |
| `VALIDATION_ERROR` | 422 | Некорректные поля body/query/params |
| `INVALID_JSON` | 400 | Битый JSON в теле |
| `PAYLOAD_TOO_LARGE` | 413 | Тело больше `BODY_LIMIT` |
| `NOT_FOUND` | 404 | Ресурс/эндпоинт не найден |
| `CONFLICT` | 409 | Дубль серийного номера, недопустимый переход статуса, удаление оборудования с открытыми заявками |
| `RATE_LIMIT_EXCEEDED` | 429 | Превышен лимит частоты запросов |
| `EXTERNAL_API_ERROR` | 502 | Погодный API недоступен/ошибся |
| `INTERNAL_ERROR` | 500 | Необработанная ошибка |

## Примеры запросов и ответов

### Создание оборудования

```http
POST /api/equipment
Content-Type: application/json

{
  "name": "Ветрогенератор W-01",
  "type": "turbine",
  "serialNumber": "SN-001",
  "location": { "lat": 54.35, "lon": 37.61 },
  "installedAt": "2024-05-01"
}
```

```http
HTTP/1.1 201 Created
Location: /api/equipment/5b3e5f1c-...

{
  "id": "5b3e5f1c-...",
  "name": "Ветрогенератор W-01",
  "type": "turbine",
  "serialNumber": "SN-001",
  "location": { "lat": 54.35, "lon": 37.61 },
  "status": "operational",
  "installedAt": "2024-05-01",
  "createdAt": "2026-09-20T00:00:00.000Z",
  "updatedAt": "2026-09-20T00:00:00.000Z"
}
```

Дубль серийного номера:

```http
HTTP/1.1 409 Conflict
{
  "error": {
    "code": "CONFLICT",
    "message": "Оборудование с серийным номером «SN-001» уже существует",
    "requestId": "..."
  }
}
```

### Недопустимый переход статуса

```http
PATCH /api/requests/:id/status
Content-Type: application/json
{ "status": "new" }        // заявка уже в статусе done
```

```http
HTTP/1.1 409 Conflict
{
  "error": {
    "code": "CONFLICT",
    "message": "Переход из статуса «done» в «new» недопустим",
    "requestId": "..."
  }
}
```

### Прогноз погоды и пригодность окна

```http
GET /api/equipment/:id/weather
```

```json
{
  "equipmentId": "5b3e5f1c-...",
  "location": { "lat": 54.35, "lon": 37.61 },
  "rule": { "maxWindKmph": 15, "allowedPrecipitationMm": 0, "forecastDays": 5 },
  "forecast": [
    { "date": "2026-09-21", "tempMax": 20.1, "tempMin": 11.3, "precipitationMm": 0, "windMaxKmph": 9.4, "suitable": true },
    { "date": "2026-09-22", "tempMax": 18.4, "tempMin": 12.0, "precipitationMm": 5.8, "windMaxKmph": 15.5, "suitable": false }
  ]
}
```

**Правило пригодности окна наружных работ** (описано в конфигурации):
день пригоден, если за сутки выпало не более `WEATHER_ALLOWED_PRECIPITATION_MM`
осадков **и** максимальная скорость ветра ниже `WEATHER_MAX_WIND_MS`.
Пороги задаются в переменных окружения.

Если погодный API недоступен — сервис не падает:

```http
HTTP/1.1 502 Bad Gateway
{
  "error": {
    "code": "EXTERNAL_API_ERROR",
    "message": "Погодный сервис временно недоступен, повторите попытку позже",
    "requestId": "..."
  }
}
```

## Безопасность

- **CORS.** Разрешены только источники из `CORS_ORIGINS` (список через запятую),
  «звёздочка» не используется. Для демо разрешены локальные источники
  `http://localhost:3000` и `http://localhost:8080` — они представляют страницу,
  которая работает с API через `fetch`, и сам сервер. В production список
  заменяется реальными доменами фронтенда.
- **Rate limiting.** На все маршруты `/api` действует лимит
  `RATE_LIMIT_MAX` запросов за `RATE_LIMIT_WINDOW_MS` мс. При превышении — `429`
  с заголовками `RateLimit-*` (draft-8) и ответом в едином формате ошибки.
- **Защитные заголовки** — `helmet`; размер тела ограничен `BODY_LIMIT` (100kb) → `413`.
- **Cookie не используются**, поэтому флаги `HttpOnly`/`Secure`/`SameSite` не требуются.
- **Секреты.** В репозитории только `.env.example`; `.env` в `.gitignore`.
  В `production` стек-трейсы и внутренние сообщения не попадают в ответ.

## Логирование

- Каждый запрос логируется (pino): метод, путь, статус, `responseTime`,
  `X-Request-Id`. `/api/health` игнорируется.
- Ошибки логируются на `error`/`warn` с `requestId`, который возвращается клиенту.
- Чувствительные поля (authorization, cookie, password, token) вырезаются из логов.
- `console.log` в коде отсутствует; уровни — из `LOG_LEVEL`.

## Структура проекта

```
src/
  index.ts               # запуск сервера (bootstrap, graceful shutdown)
  app.ts                 # сборка приложения createApp(storage) — подключается в тестах
  config.ts              # конфигурация из переменных окружения (zod)
  errors.ts              # типы ошибок приложения
  types.d.ts             # расширение Express.Request (req.valid)
  domain/                # доменные модели и enum-типы
  repositories/          # интерфейсы репозиториев + JSON-реализация (createStorage)
  services/              # бизнес-логика (equipment, request, weather)
  controllers/           # тонкие обработчики HTTP (оба контроллера)
  routes/                # api/equipment/requests маршрутизация
  schemas/               # zod-схемы body/query/params
  middleware/            # validate, error-handler, rate-limit
  lib/                   # logger, http-logger, context (AsyncLocalStorage),
                         # async-handler, json-store
docs/postman/            # коллекция Postman
data/                    # JSON-хранилище (создаётся при первом запуске, в git не входит)
```

Архитектура слоёв: `маршруты → контроллеры → сервисы → репозитории`. Бизнес-логика
живёт в сервисах (`EquipmentService`, `RequestService`, `WeatherService`), работа с
данными — только в репозиториях. Замена JSON-хранилища на PostgreSQL на Неделе 3
затронет только каталог `repositories/`.

## Тестирование в Postman

Коллекция в `docs/postman/caselab-requests.postman_collection.json`:

1. Импортируйте коллекцию в Postman (`Import → Upload Files`).
2. Создайте окружение, в нём задайте `baseUrl` (например, `http://localhost:3000`).
3. Запустите группу «Equipment» (создаются записи, `equipmentId` сохраняется в
   переменные), затем «Requests» — заявки привязываются к созданному оборудованию.
4. В коллекцию включены негативные сценарии: 400/422, 404, 409 (дубль серийного
   номера и недопустимый переход статуса), 429; в запросах написаны автотесты
   `pm.test` на код ответа и структуру тела.