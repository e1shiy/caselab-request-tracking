import { EQUIPMENT_STATUSES, EQUIPMENT_TYPES } from '../domain/equipment.js';
import { REQUEST_PRIORITIES, REQUEST_STATUSES } from '../domain/request.js';
import { ASSIGNEE_ROLES } from '../domain/technician.js';
import { USER_ROLES } from '../domain/user.js';

// Спецификация собрана вручную: zod-схемы описывают проверку запроса, но не
// ответ, а ответы здесь различаются по коду и по ролям. Дублировать описание
// каждой операции в разметке OpenAPI дороже, чем держать один документ рядом
// с роутерами.

type Schema = Record<string, unknown>;

const ref = (name: string): Schema => ({ $ref: `#/components/schemas/${name}` });

const json = (schema: Schema): Schema => ({
  content: { 'application/json': { schema } },
});

const response = (description: string, schema?: Schema): Schema => ({
  description,
  ...(schema ? json(schema) : {}),
});

const errorResponse = (description: string): Schema =>
  response(description, ref('Error'));

const errorRef = (name: string): Schema => ({
  $ref: `#/components/responses/${name}`,
});

const paginated = (item: Schema): Schema => ({
  type: 'object',
  properties: { data: { type: 'array', items: item }, meta: ref('PageMeta') },
  required: ['data', 'meta'],
});

const uuid = (description: string): Schema => ({
  name: 'id',
  in: 'path',
  required: true,
  description,
  schema: { type: 'string', format: 'uuid' },
});

const ID_PARAM = uuid('Идентификатор ресурса (UUID)');
const TECHNICIAN_ID_PARAM = uuid('Идентификатор специалиста (UUID)');

const PAGINATION_PARAMS: Schema[] = [
  {
    name: 'page',
    in: 'query',
    description: 'Номер страницы, начиная с 1',
    schema: { type: 'integer', minimum: 1, default: 1 },
  },
  {
    name: 'limit',
    in: 'query',
    description: 'Размер страницы',
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
  },
  {
    name: 'offset',
    in: 'query',
    description: 'Смещение от начала выборки (вместо page)',
    schema: { type: 'integer', minimum: 0, default: 0 },
  },
];

const dateFilter = (name: string, description: string): Schema => ({
  name,
  in: 'query',
  description,
  schema: { type: 'string', format: 'date' },
});

const sortParam = (values: readonly string[], description: string): Schema => ({
  name: 'sort',
  in: 'query',
  description,
  schema: { type: 'string', enum: values },
});

const REQUEST_LIST_PARAMS: Schema[] = [
  {
    name: 'status',
    in: 'query',
    description: 'Фильтр по статусу',
    schema: { type: 'string', enum: REQUEST_STATUSES },
  },
  {
    name: 'priority',
    in: 'query',
    description: 'Фильтр по приоритету',
    schema: { type: 'string', enum: REQUEST_PRIORITIES },
  },
  {
    name: 'equipmentId',
    in: 'query',
    description: 'Фильтр по оборудованию',
    schema: { type: 'string', format: 'uuid' },
  },
  dateFilter('dateFrom', 'Начало периода по дате создания'),
  dateFilter('dateTo', 'Конец периода по дате создания'),
  sortParam(['createdAt', 'updatedAt', 'priority', 'plannedAt', 'status'], 'Поле сортировки, можно с суффиксом `-` для убывания'),
  ...PAGINATION_PARAMS,
];

export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'CaseLab Request Tracking API',
    version: '1.0.0',
    description: [
      'API учёта заявок на обслуживание оборудования.',
      '',
      '## Аутентификация',
      '',
      '1. `POST /api/auth/login` (или `register`) возвращает `accessToken`.',
      '2. Вставьте токен в поле **access-токен** вверху страницы или нажмите',
      '   **Authorize** и укажите его же — оба способа сохраняют токен в',
      '   localStorage браузера.',
      '3. Все защищённые операции выполняются с заголовком',
      '   `Authorization: Bearer <accessToken>`.',
      '',
      'Refresh-токен хранится в httpOnly-cookie `refresh_token` с `Path=/api/auth`',
      'и обновляется через `POST /api/auth/refresh`: после каждого обновления',
      'прежний токен отзывается, повторное использование отозванного токена',
      'закрывает все сессии пользователя.',
      '',
      '## Роли',
      '',
      '* `viewer` — чтение всего справочника и заявок;',
      '* `technician` — создание и редактирование заявок, смена статуса и',
      '  назначение бригады только в заявках, где специалист числится',
      '  исполнителем;',
      '* `admin` — все операции, включая удаление заявок и управление',
      '  оборудованием.',
      '',
      '## Ошибки',
      '',
      'Все ошибки возвращаются в едином формате `{ "error": { "code", "message",',
      '"requestId" } }`; `requestId` совпадает с заголовком `X-Request-Id` и',
      'приходит в логи. В `details` приходят подробности проверки полей для',
      '422.',
      '',
      'Health-check (`/api/health/live`, `/api/health/ready`) и `/metrics`',
      'токена не требуют.',
    ].join('\n'),
  },
  servers: [{ url: '/', description: 'Текущий origin (nginx или локальный сервер)' }],
  tags: [
    { name: 'System', description: 'Health-check и метрики' },
    { name: 'Auth', description: 'Аутентификация и текущий пользователь' },
    { name: 'Equipment', description: 'Справочник оборудования' },
    { name: 'Requests', description: 'Заявки на обслуживание' },
    { name: 'Reports', description: 'Отчёты и сводки' },
  ],
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Access-токен из /api/auth/login. В Swagger UI можно вставить его в поле «access-токен» или через кнопку Authorize.',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                description: 'Машиночитаемый код: VALIDATION_ERROR, NOT_FOUND, CONFLICT, UNAUTHORIZED, FORBIDDEN, RATE_LIMIT_EXCEEDED, SERVICE_UNAVAILABLE и другие',
              },
              message: { type: 'string', description: 'Человекочитаемое сообщение' },
              requestId: { type: 'string', description: 'Идентификатор запроса для корреляции с логами' },
              details: { description: 'Подробности проверки полей (422)' },
            },
            required: ['code', 'message', 'requestId'],
          },
        },
        required: ['error'],
      },
      PageMeta: {
        type: 'object',
        properties: {
          total: { type: 'integer', description: 'Всего записей по выборке без пагинации' },
          page: { type: 'integer', description: 'Текущая страница' },
          limit: { type: 'integer', description: 'Размер страницы' },
        },
        required: ['total', 'page', 'limit'],
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          fullName: { type: 'string' },
          role: { type: 'string', enum: USER_ROLES },
          technicianId: { type: 'string', format: 'uuid', nullable: true, description: 'Привязанный специалист, если учётная запись создана для техника' },
          createdAt: { type: 'string', format: 'date-time' },
        },
        required: ['id', 'email', 'fullName', 'role', 'createdAt'],
      },
      AuthSession: {
        type: 'object',
        properties: {
          accessToken: { type: 'string', description: 'JWT для заголовка Authorization, TTL 900 секунд' },
          tokenType: { type: 'string', examples: ['Bearer'] },
          expiresIn: { type: 'integer', description: 'Время жизни access-токена в секундах' },
          user: ref('User'),
        },
        required: ['accessToken', 'tokenType', 'expiresIn', 'user'],
      },
      EquipmentLocation: {
        type: 'object',
        properties: {
          lat: { type: 'number', minimum: -90, maximum: 90 },
          lon: { type: 'number', minimum: -180, maximum: 180 },
        },
        required: ['lat', 'lon'],
      },
      Equipment: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          siteId: { type: 'string', format: 'uuid', nullable: true },
          name: { type: 'string' },
          type: { type: 'string', enum: EQUIPMENT_TYPES },
          serialNumber: { type: 'string' },
          location: ref('EquipmentLocation'),
          status: { type: 'string', enum: EQUIPMENT_STATUSES },
          installedAt: { type: 'string', format: 'date' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
        required: ['id', 'name', 'type', 'serialNumber', 'location', 'status', 'installedAt', 'createdAt', 'updatedAt'],
      },
      EquipmentCard: {
        allOf: [
          ref('Equipment'),
          {
            type: 'object',
            properties: {
              passport: {
                nullable: true,
                description: 'Паспорт оборудования, если он заведён; поля приходят из внешнего источника',
              },
            },
          },
        ],
      },
      EquipmentCreate: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 3, maxLength: 100 },
          type: { type: 'string', enum: EQUIPMENT_TYPES },
          serialNumber: { type: 'string', minLength: 1, maxLength: 100 },
          location: ref('EquipmentLocation'),
          status: { type: 'string', enum: EQUIPMENT_STATUSES, default: 'operational' },
          installedAt: { type: 'string', format: 'date', description: 'Дата установки, не позже сегодняшней' },
        },
        required: ['name', 'type', 'serialNumber', 'location', 'installedAt'],
      },
      EquipmentUpdate: {
        type: 'object',
        description: 'Частичное обновление: хотя бы одно поле',
        properties: {
          name: { type: 'string', minLength: 3, maxLength: 100 },
          type: { type: 'string', enum: EQUIPMENT_TYPES },
          serialNumber: { type: 'string', minLength: 1, maxLength: 100 },
          location: ref('EquipmentLocation'),
          status: { type: 'string', enum: EQUIPMENT_STATUSES },
          installedAt: { type: 'string', format: 'date' },
        },
      },
      Request: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          equipmentId: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          description: { type: 'string' },
          priority: { type: 'string', enum: REQUEST_PRIORITIES },
          status: { type: 'string', enum: REQUEST_STATUSES },
          plannedAt: { type: 'string', format: 'date-time', nullable: true },
          author: { type: 'string', description: 'Email автора, берётся из access-токена' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
        required: ['id', 'equipmentId', 'title', 'description', 'priority', 'status', 'createdAt', 'updatedAt'],
      },
      RequestCard: {
        allOf: [
          ref('Request'),
          {
            type: 'object',
            properties: { assignees: { type: 'array', items: ref('AssigneeView') } },
            required: ['assignees'],
          },
        ],
      },
      RequestCreate: {
        type: 'object',
        properties: {
          equipmentId: { type: 'string', format: 'uuid' },
          title: { type: 'string', minLength: 5, maxLength: 120 },
          description: { type: 'string', maxLength: 2000 },
          priority: { type: 'string', enum: REQUEST_PRIORITIES, default: 'medium' },
          plannedAt: { type: 'string', format: 'date-time' },
        },
        required: ['equipmentId', 'title'],
      },
      RequestUpdate: {
        type: 'object',
        description: 'Частичное обновление: хотя бы одно поле. author и status здесь не меняются',
        properties: {
          title: { type: 'string', minLength: 5, maxLength: 120 },
          description: { type: 'string', maxLength: 2000 },
          priority: { type: 'string', enum: REQUEST_PRIORITIES },
          plannedAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      RequestStatusChange: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: REQUEST_STATUSES,
            description:
              'Допустимые переходы: new → in_progress, new → rejected, in_progress → done, in_progress → rejected. Из done и rejected выхода нет.',
          },
          comment: { type: 'string', maxLength: 500, description: 'Попадает в журнал переходов' },
        },
        required: ['status'],
      },
      AssigneeInput: {
        type: 'object',
        properties: {
          technicianId: { type: 'string', format: 'uuid' },
          role: { type: 'string', enum: ASSIGNEE_ROLES },
          plannedHours: { type: 'number', minimum: 0, maximum: 1000 },
        },
        required: ['technicianId', 'role'],
      },
      AssigneeView: {
        type: 'object',
        properties: {
          requestId: { type: 'string', format: 'uuid' },
          technicianId: { type: 'string', format: 'uuid' },
          role: { type: 'string', enum: ASSIGNEE_ROLES },
          plannedHours: { type: 'number', nullable: true },
          assignedAt: { type: 'string', format: 'date-time' },
          fullName: { type: 'string' },
          specialization: { type: 'string' },
          personnelNumber: { type: 'string' },
        },
        required: ['requestId', 'technicianId', 'role', 'assignedAt', 'fullName'],
      },
      StatusHistoryEntry: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          requestId: { type: 'string', format: 'uuid' },
          previousStatus: { type: 'string', enum: [...REQUEST_STATUSES, null] },
          newStatus: { type: 'string', enum: REQUEST_STATUSES },
          changedBy: { type: 'string', nullable: true, description: 'Email того, кто сменил статус' },
          comment: { type: 'string', nullable: true },
          changedAt: { type: 'string', format: 'date-time' },
        },
        required: ['id', 'requestId', 'newStatus', 'changedAt'],
      },
      WeatherRule: {
        type: 'object',
        properties: {
          maxWindKmph: { type: 'number', description: 'Порог максимальной скорости ветра' },
          allowedPrecipitationMm: { type: 'number' },
          forecastDays: { type: 'integer' },
        },
      },
      ForecastDay: {
        type: 'object',
        properties: {
          date: { type: 'string', format: 'date' },
          tempMax: { type: 'number', nullable: true },
          tempMin: { type: 'number', nullable: true },
          precipitationMm: { type: 'number' },
          windMaxKmph: { type: 'number' },
          suitable: { type: 'boolean', description: 'Окно пригодно для работ' },
        },
        required: ['date', 'precipitationMm', 'windMaxKmph', 'suitable'],
      },
      EquipmentForecast: {
        type: 'object',
        properties: {
          equipmentId: { type: 'string', format: 'uuid' },
          location: ref('EquipmentLocation'),
          rule: ref('WeatherRule'),
          forecast: { type: 'array', items: ref('ForecastDay') },
        },
        required: ['equipmentId', 'location', 'rule', 'forecast'],
      },
      SiteSummary: {
        type: 'object',
        properties: {
          siteId: { type: 'string', format: 'uuid' },
          siteName: { type: 'string' },
          siteCode: { type: 'string' },
          region: { type: 'string' },
          equipmentTotal: { type: 'integer' },
          requestsTotal: { type: 'integer' },
          byStatus: { type: 'object', additionalProperties: { type: 'integer' } },
          byPriority: { type: 'object', additionalProperties: { type: 'integer' } },
          averageCloseSeconds: { type: 'number', nullable: true, description: 'Среднее время закрытия заявки, null если закрытых нет' },
        },
        required: ['siteId', 'siteName', 'siteCode', 'region', 'equipmentTotal', 'requestsTotal', 'byStatus', 'byPriority'],
      },
      EquipmentLoadRow: {
        type: 'object',
        properties: {
          equipmentId: { type: 'string', format: 'uuid' },
          serialNumber: { type: 'string' },
          equipmentName: { type: 'string' },
          siteId: { type: 'string', format: 'uuid', nullable: true },
          siteName: { type: 'string', nullable: true },
          requestsTotal: { type: 'integer' },
          requestsClosed: { type: 'integer' },
          plannedHours: { type: 'number' },
          lastServicedAt: { type: 'string', format: 'date-time', nullable: true },
        },
        required: ['equipmentId', 'serialNumber', 'equipmentName', 'requestsTotal', 'requestsClosed', 'plannedHours'],
      },
      HealthLive: {
        type: 'object',
        properties: {
          status: { type: 'string', examples: ['ok'] },
          uptimeSeconds: { type: 'integer' },
          timestamp: { type: 'string', format: 'date-time' },
        },
        required: ['status', 'uptimeSeconds', 'timestamp'],
      },
      HealthReady: {
        type: 'object',
        properties: {
          status: { type: 'string', examples: ['ready'] },
          database: { type: 'string', examples: ['up'] },
          uptimeSeconds: { type: 'integer' },
          timestamp: { type: 'string', format: 'date-time' },
        },
        required: ['status', 'database', 'uptimeSeconds', 'timestamp'],
      },
    },
    parameters: {
      Id: ID_PARAM,
      TechnicianId: TECHNICIAN_ID_PARAM,
      Page: PAGINATION_PARAMS[0],
      Limit: PAGINATION_PARAMS[1],
      Offset: PAGINATION_PARAMS[2],
    },
    responses: {
      BadRequest: errorResponse('Некорректные параметры запроса: код BAD_REQUEST'),
      ValidationError: errorResponse('Ошибки проверки тела, query или params: код VALIDATION_ERROR, подробности в details'),
      Unauthorized: errorResponse('Нет токена, он истёк или невалиден: код UNAUTHORIZED'),
      Forbidden: errorResponse('Роль или принадлежность заявки не позволяют операцию: код FORBIDDEN'),
      NotFound: errorResponse('Ресурс не найден: код NOT_FOUND'),
      Conflict: errorResponse('Конфликт состояния или уникальности: код CONFLICT'),
      PayloadTooLarge: errorResponse('Тело запроса больше BODY_LIMIT: код PAYLOAD_TOO_LARGE'),
      TooManyRequests: errorResponse('Исчерпан лимит частоты запросов: код RATE_LIMIT_EXCEEDED, заголовки RateLimit-*'),
      ServiceUnavailable: errorResponse('Зависимость недоступна, например PostgreSQL: код SERVICE_UNAVAILABLE'),
      ExternalApiError: errorResponse('Погодный API недоступен: код EXTERNAL_API_ERROR'),
    },
  },
  paths: {
    '/api/health': {
      get: {
        tags: ['System'],
        summary: 'Совместимость: процесс отвечает',
        description: 'Без обращения к базе. Ответ `{"status":"ok"}`.',
        security: [],
        responses: { '200': response('Процесс работает', { type: 'object', properties: { status: { type: 'string', examples: ['ok'] } }, required: ['status'] }) },
      },
    },
    '/api/health/live': {
      get: {
        tags: ['System'],
        summary: 'Liveness',
        description: 'Не обращается к базе: перезапуск при недоступности PostgreSQL ничего не даёт.',
        security: [],
        responses: { '200': response('Процесс жив', ref('HealthLive')) },
      },
    },
    '/api/health/ready': {
      get: {
        tags: ['System'],
        summary: 'Readiness',
        description: 'Выполняет `SELECT 1`. Используется в healthcheck контейнера и балансировщиком.',
        security: [],
        responses: {
          '200': response('База доступна', ref('HealthReady')),
          '503': errorRef('ServiceUnavailable'),
        },
      },
    },
    '/metrics': {
      get: {
        tags: ['System'],
        summary: 'Метрики Prometheus',
        description:
          'Текстовый формат Prometheus: http_requests_total, http_request_duration_seconds, http_requests_in_flight, app_database_up и стандартные app_process_*/app_nodejs_* с префиксом app_. Токен не требуется; доступ извне закрывает nginx.',
        security: [],
        responses: { '200': response('Метрики', { type: 'string' }) },
      },
    },
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Регистрация',
        description: 'Создаёт учётную запись с ролью `viewer` и выдаёт refresh-cookie.',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8, description: 'Минимум 8 символов, проверяются и буквы, и цифры' },
                  fullName: { type: 'string', minLength: 2, maxLength: 100 },
                },
                required: ['email', 'password', 'fullName'],
              },
            },
          },
        },
        responses: {
          '201': response('Учётная запись создана', ref('AuthSession')),
          '409': errorRef('Conflict'),
          '422': errorRef('ValidationError'),
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Вход',
        description: 'Возвращает access-токен и ставит refresh-cookie `refresh_token` (httpOnly, Path=/api/auth). Ошибка входа всегда одна и не выдаёт, существует ли email.',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
                required: ['email', 'password'],
              },
            },
          },
        },
        responses: {
          '200': response('Вход выполнен', ref('AuthSession')),
          '401': errorRef('Unauthorized'),
          '422': errorRef('ValidationError'),
          '429': errorRef('TooManyRequests'),
        },
      },
    },
    '/api/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Обновление токенов',
        description:
          'Читает refresh-cookie, отзывает её и выдаёт новую пару. Повторное использование уже отозванного токена закрывает все сессии пользователя.',
        security: [],
        responses: {
          '200': response('Новая пара токенов', ref('AuthSession')),
          '401': errorRef('Unauthorized'),
        },
      },
    },
    '/api/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Выход',
        description: 'Отзывает refresh-токен и очищает cookie. Идемпотентен: без cookie или с истёкшей cookie тоже 204.',
        security: [],
        responses: { '204': response('Сеанс закрыт') },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Текущий пользователь',
        responses: {
          '200': response('Профиль пользователя', ref('User')),
          '401': errorRef('Unauthorized'),
        },
      },
    },
    '/api/equipment': {
      get: {
        tags: ['Equipment'],
        summary: 'Список оборудования',
        parameters: [
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: EQUIPMENT_STATUSES },
          },
          { name: 'type', in: 'query', schema: { type: 'string', enum: EQUIPMENT_TYPES } },
          dateFilter('installedFrom', 'Оборудование, установленное не раньше даты'),
          dateFilter('installedTo', 'Оборудование, установленное не позже даты'),
          sortParam(['name', 'type', 'status', 'serialNumber', 'installedAt', 'createdAt'], 'Поле сортировки, можно с суффиксом `-` для убывания'),
          ...PAGINATION_PARAMS,
        ],
        responses: {
          '200': response('Страница оборудования', paginated(ref('Equipment'))),
          '400': errorRef('BadRequest'),
          '401': errorRef('Unauthorized'),
          '422': errorRef('ValidationError'),
        },
      },
      post: {
        tags: ['Equipment'],
        summary: 'Создание оборудования',
        description: 'Роль `admin` или `technician`. При 201 выдаётся заголовок `Location`.',
        requestBody: { required: true, ...json(ref('EquipmentCreate')) },
        responses: {
          '201': response('Оборудование создано', ref('Equipment')),
          '401': errorRef('Unauthorized'),
          '403': errorRef('Forbidden'),
          '409': errorRef('Conflict'),
          '422': errorRef('ValidationError'),
        },
      },
    },
    '/api/equipment/{id}': {
      get: {
        tags: ['Equipment'],
        summary: 'Карточка оборудования с паспортом',
        parameters: [ID_PARAM],
        responses: {
          '200': response('Карточка', ref('EquipmentCard')),
          '401': errorRef('Unauthorized'),
          '404': errorRef('NotFound'),
          '422': errorRef('ValidationError'),
        },
      },
      patch: {
        tags: ['Equipment'],
        summary: 'Частичное обновление оборудования',
        description: 'Роль `admin` или `technician`.',
        parameters: [ID_PARAM],
        requestBody: { required: true, ...json(ref('EquipmentUpdate')) },
        responses: {
          '200': response('Обновлённое оборудование', ref('Equipment')),
          '401': errorRef('Unauthorized'),
          '403': errorRef('Forbidden'),
          '404': errorRef('NotFound'),
          '409': errorRef('Conflict'),
          '422': errorRef('ValidationError'),
        },
      },
      delete: {
        tags: ['Equipment'],
        summary: 'Удаление оборудования',
        description: 'Роль `admin` или `technician`. При открытых заявках — 409.',
        parameters: [ID_PARAM],
        responses: {
          '204': response('Удалено'),
          '401': errorRef('Unauthorized'),
          '403': errorRef('Forbidden'),
          '404': errorRef('NotFound'),
          '409': errorRef('Conflict'),
        },
      },
    },
    '/api/equipment/{id}/requests': {
      get: {
        tags: ['Equipment', 'Requests'],
        summary: 'Заявки по оборудованию',
        parameters: [ID_PARAM, ...REQUEST_LIST_PARAMS],
        responses: {
          '200': response('Страница заявок', paginated(ref('Request'))),
          '400': errorRef('BadRequest'),
          '401': errorRef('Unauthorized'),
          '404': errorRef('NotFound'),
          '422': errorRef('ValidationError'),
        },
      },
    },
    '/api/equipment/{id}/weather': {
      get: {
        tags: ['Equipment'],
        summary: 'Прогноз погоды и пригодность окна работ',
        description: 'Координаты берутся из оборудования. Если внешний погодный API недоступен — 502, сервис при этом не падает.',
        parameters: [ID_PARAM],
        responses: {
          '200': response('Прогноз по дням', ref('EquipmentForecast')),
          '401': errorRef('Unauthorized'),
          '404': errorRef('NotFound'),
          '502': errorRef('ExternalApiError'),
        },
      },
    },
    '/api/requests': {
      get: {
        tags: ['Requests'],
        summary: 'Список заявок',
        parameters: REQUEST_LIST_PARAMS,
        responses: {
          '200': response('Страница заявок', paginated(ref('Request'))),
          '400': errorRef('BadRequest'),
          '401': errorRef('Unauthorized'),
          '422': errorRef('ValidationError'),
        },
      },
      post: {
        tags: ['Requests'],
        summary: 'Создание заявки',
        description: 'Роль `admin` или `technician`. `author` берётся из access-токена, в теле его нет.',
        requestBody: { required: true, ...json(ref('RequestCreate')) },
        responses: {
          '201': response('Заявка создана', ref('Request')),
          '401': errorRef('Unauthorized'),
          '403': errorRef('Forbidden'),
          '404': errorRef('NotFound'),
          '422': errorRef('ValidationError'),
        },
      },
    },
    '/api/requests/{id}': {
      get: {
        tags: ['Requests'],
        summary: 'Карточка заявки с бригадой',
        parameters: [ID_PARAM],
        responses: {
          '200': response('Карточка', ref('RequestCard')),
          '401': errorRef('Unauthorized'),
          '404': errorRef('NotFound'),
        },
      },
      patch: {
        tags: ['Requests'],
        summary: 'Редактирование полей заявки',
        description: 'Роль `admin` или назначенный исполнитель `technician`. Статус и автор здесь не меняются.',
        parameters: [ID_PARAM],
        requestBody: { required: true, ...json(ref('RequestUpdate')) },
        responses: {
          '200': response('Обновлённая заявка', ref('Request')),
          '401': errorRef('Unauthorized'),
          '403': errorRef('Forbidden'),
          '404': errorRef('NotFound'),
          '422': errorRef('ValidationError'),
        },
      },
      delete: {
        tags: ['Requests'],
        summary: 'Удаление заявки',
        description: 'Только роль `admin`.',
        parameters: [ID_PARAM],
        responses: {
          '204': response('Удалено'),
          '401': errorRef('Unauthorized'),
          '403': errorRef('Forbidden'),
          '404': errorRef('NotFound'),
        },
      },
    },
    '/api/requests/{id}/status': {
      patch: {
        tags: ['Requests'],
        summary: 'Смена статуса с проверкой перехода',
        description:
          'Допустимы переходы new → in_progress → done, new → in_progress → rejected и new → rejected. Переход в in_progress требует назначенную бригаду, изменение попадает в журнал переходов.',
        parameters: [ID_PARAM],
        requestBody: { required: true, ...json(ref('RequestStatusChange')) },
        responses: {
          '200': response('Заявка с новым статусом', ref('Request')),
          '401': errorRef('Unauthorized'),
          '403': errorRef('Forbidden'),
          '404': errorRef('NotFound'),
          '409': errorRef('Conflict'),
          '422': errorRef('ValidationError'),
        },
      },
    },
    '/api/requests/{id}/assignees': {
      post: {
        tags: ['Requests'],
        summary: 'Полная замена состава бригады',
        description: 'Роль `admin` или назначенный исполнитель `technician`. Ровно один ведущий (lead).',
        parameters: [ID_PARAM],
        requestBody: {
          required: true,
          ...json({ type: 'object', properties: { assignees: { type: 'array', items: ref('AssigneeInput'), minItems: 1 } }, required: ['assignees'] }),
        },
        responses: {
          '201': response('Состав бригады обновлён', { type: 'array', items: ref('AssigneeView') }),
          '401': errorRef('Unauthorized'),
          '403': errorRef('Forbidden'),
          '404': errorRef('NotFound'),
          '409': errorRef('Conflict'),
          '422': errorRef('ValidationError'),
        },
      },
    },
    '/api/requests/{id}/assignees/{technicianId}': {
      delete: {
        tags: ['Requests'],
        summary: 'Снятие исполнителя из бригады',
        description: 'Снять последнего ведущего или ведущего при других исполнителях нельзя — 409.',
        parameters: [ID_PARAM, TECHNICIAN_ID_PARAM],
        responses: {
          '200': response('Состав бригады', { type: 'array', items: ref('AssigneeView') }),
          '401': errorRef('Unauthorized'),
          '403': errorRef('Forbidden'),
          '404': errorRef('NotFound'),
          '409': errorRef('Conflict'),
        },
      },
    },
    '/api/requests/{id}/history': {
      get: {
        tags: ['Requests'],
        summary: 'Журнал переходов статуса',
        description: 'От свежих записей к старым.',
        parameters: [ID_PARAM],
        responses: {
          '200': response('История переходов', { type: 'array', items: ref('StatusHistoryEntry') }),
          '401': errorRef('Unauthorized'),
          '404': errorRef('NotFound'),
        },
      },
    },
    '/api/sites/{id}/summary': {
      get: {
        tags: ['Reports'],
        summary: 'Сводка по площадке',
        parameters: [uuid('Идентификатор площадки (UUID)')],
        responses: {
          '200': response('Сводка', ref('SiteSummary')),
          '401': errorRef('Unauthorized'),
          '404': errorRef('NotFound'),
        },
      },
    },
    '/api/reports/equipment-load': {
      get: {
        tags: ['Reports'],
        summary: 'Нагрузка на оборудование',
        parameters: [
          dateFilter('dateFrom', 'Начало периода'),
          dateFilter('dateTo', 'Конец периода'),
          { name: 'siteId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: REQUEST_STATUSES } },
          { name: 'priority', in: 'query', schema: { type: 'string', enum: REQUEST_PRIORITIES } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
        ],
        responses: {
          '200': response('Строки отчёта', { type: 'array', items: ref('EquipmentLoadRow') }),
          '400': errorRef('BadRequest'),
          '401': errorRef('Unauthorized'),
          '404': errorRef('NotFound'),
          '422': errorRef('ValidationError'),
        },
      },
    },
  },
};