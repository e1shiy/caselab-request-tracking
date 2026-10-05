# Runbook по эксплуатации

Документ для дежурного разработчика: что поднимать, где смотреть метрики и
логи, что делать при типовых сбоях и как обновлять проект. Описание API —
в [Swagger UI](http://localhost:8080/api/docs) и в `README.md`.

## 1. Что должно работать

| Сервис | Порт | Назначение | Проверка |
| --- | --- | --- | --- |
| `nginx` | `${HTTP_PORT:-8080}` | единственная публичная точка входа | `curl -fsS localhost:8080/healthz` |
| `app` | только внутренняя сеть 3000 | Express API и `/metrics` | `docker compose exec app node -e "fetch('http://localhost:3000/api/health/ready').then(r => r.text()).then(console.log)"` |
| `db` | `127.0.0.1:5432` | PostgreSQL 18 | `docker compose exec db pg_isready -U postgres` |
| `migrate` | — | одноразовый прогон миграций и сида | `docker compose ps migrate` → `Exited (0)` |
| `prometheus` | `127.0.0.1:9090` | сбор метрик и алерты | `curl -fsS localhost:9090/-/healthy` |
| `grafana` | `127.0.0.1:3001` | дашборд и алерты | `curl -fsS -o /dev/null -w '%{http_code}\n' localhost:3001/api/health` |

Порты БД, Prometheus и Grafana намеренно не выставлены наружу: на локальной
машине они доступны только с loopback, в сети наружу открыт только порт
nginx.

## 2. Первый запуск

```bash
cp .env.example .env
# Обязательно задать:
#   JWT_SECRET, JWT_REFRESH_SECRET — длинные случайные строки
#   DB_APP_PASSWORD, DB_MIGRATION_PASSWORD
#   GRAFANA_ADMIN_PASSWORD
npm run docker:up
docker compose ps
```

`migrate` применяет 11 миграций и сид с demo-данными. Пока он не дошёл до
`Exited (0)`, `app` не стартует: это защищает от запросов к неполной схеме.

Локально без Docker:

```bash
npm ci
npm run db:migrate
npm run db:seed
npm run dev
```

## 3. Дежурные команды

```bash
npm run docker:ps      # docker compose ps
npm run docker:logs    # docker compose logs -f app
npm run docker:up      # up -d --build
npm run docker:down    # остановить, данные сохранить
npm run docker:reset   # остановить и удалить тома (данные и БД пропадут)
npm run typecheck
npm run docs:check
npm test
npm run test:coverage
```

Логи приложения — JSON в stdout (`pino`), у каждой записи есть `requestId`,
совпадающий с заголовком `X-Request-Id` и с `error.requestId` в ответе.
Искать по конкретному запросу:

```bash
docker compose logs app | jq -c 'select(.requestId == "<requestId>")'
```

## 4. Наблюдаемость

- дашборд Grafana «Service overview»: маршруты, 5xx, p95, heap, RSS, CPU,
  event loop;
- Prometheus-алерты: `ServiceDown`, `DatabaseUnavailable`, `HighErrorRate`,
  `NoTraffic`, `SlowRequests`, `RequestQueueGrowing`, `HighHeapUsage`,
  `CpuSaturation`;
- Grafana-алерты (унифицированные): приложение не отвечает, приложение не
  видит базу, p95 выше 1 секунды;
- `/metrics` отдаёт только приложение. Через nginx путь закрыт и отвечает
  404: метрики читаются из внутренней сети или через Prometheus.

Проверка алертов вручную:

```bash
curl -s localhost:9090/api/v1/rules | jq '.data.groups[].rules[] | {name: .name, state: .state}'
curl -s localhost:9090/api/v1/alerts | jq '.data.alerts[] | {name: .labels.alertname, state: .state}'
```

## 5. Типовые сбои

### `app` не стартует, в логах `relation "users" does not exist`

Не завершился `migrate`. Смотрите `docker compose logs migrate`; чаще всего
нет прав на DDL у `DB_MIGRATION_USER` или применена только часть миграций:

```bash
docker compose run --rm migrate node dist/db/cli/migrate.js status
```

Роль `app_rw` (под которой работает `app`) прав на DDL не имеет — это
намеренно: если миграции откатились или не применились, приложение упадёт
на старте, а не на первом же запросе.

### `/api/health/ready` отдаёт 503

Проблема с БД: приложение отвечает, но не может выполнить `SELECT 1`.
Проверьте `docker compose exec db pg_isready -u postgres -d appdb` и
состояние контейнера `db`. `live` при этом остаётся 200 — процесс жив.

### `429 RATE_LIMIT_EXCEEDED`

Лимит частоты в памяти процесса. Либо ждём окно (`RATE_LIMIT_WINDOW_MS`),
либо клиент делает слишком много входа — тогда счётчик идёт по паре
«IP + email». При нескольких инстансах лимит умножается на число процессов:
общего счётчика пока нет (см. «Отклонения и ограничения» в `README.md`).

### `502 EXTERNAL_API_ERROR`

Погодный сервис недоступен. Заявки и каталог при этом работают: ошибка
затрагивает только `/api/equipment/:id/weather`. Проверьте
`WEATHER_API_URL`, доступность внешнего сервиса и его ключ.

### `500 INTERNAL_ERROR` без деталей

В production детали намеренно скрыты, полный текст ошибки — только в логах
приложения. Ищите запись с тем же `requestId`, уровнем `error` и полем `err`.
В development (`NODE_ENV=development`) сообщение возвращается клиенту.

### Заявка не переводится в `in_progress`

Требуется назначенная бригада: сначала `POST /api/requests/:id/assignees`,
причём ровно один `lead`. Два `lead` или ни одного даёт 422 на уровне схемы,
снятие ведущего из непустой бригады — 409.

### Grafana показывает «No data»

Проверьте цели в Prometheus (`Status → Targets`) и `datasource uid`
`prometheus` в дашборде. Если цели `app` не собираются, приложение
недоступно из сети compose — проверьте `docker compose ps app`.

## 6. Резервное копирование

Данные лежат в именованном томе `pgdata`. Дамп без остановки сервиса:

Роль и имя базы берём из `.env` (`DB_MIGRATION_USER`, `DB_NAME`).

```bash
docker compose exec -T db pg_dump -U postgres -d appdb -Fc > backup.dump
```

Восстановление:

```bash
docker compose exec -T db pg_restore -U postgres -d appdb --clean --if-exists < backup.dump
```

`pg_dump` есть в образе `postgres`, а `wget`/`curl` в образе приложения нет:
внутрь контейнера ходим через `node -e "fetch(...)"`.

Схема миграций и demo-данные восстанавливаются из репозитория
(`npm run db:migrate`, `npm run db:seed`), поэтому бэкап нужен только для
рабочих данных.

## 7. Обновление

```bash
git pull
npm ci
npm run typecheck && npm test && npm run docs:check
npm run docker:up
```

`migrate` применит новые миграции перед стартом `app`. Откат миграции —
`npm run db:rollback` (Umzug, по одной), после чего `npm run db:verify`.

## 8. Проверка перед деплоем

```bash
npm ci
npm run typecheck
npm run build
npm run docs:check
npm test                  # unit + integration
npm run test:coverage
npm run docker:up
npm run test:e2e          # Newman через nginx
npm run docker:down
```

E2E идёт по коллекции Postman и тратит почти всю квоту частоты: прогонять его
на чистом стенде (после `docker:up`) и не запускать дважды подряд, иначе
второй прогон упрётся в 429.

Критерии приёмки: `typecheck` и `docs:check` без ошибок, все тесты зелёные,
`migrate` завершился с кодом 0, `ready` отдаёт 200, Newman — 0 failures.