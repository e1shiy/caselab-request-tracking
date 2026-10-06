# Многоэтапная сборка: в рантайм попадают только собранный JavaScript,
# production-зависимости и то, что нужно для миграций и сида.

# --- сборка ----------------------------------------------------------------
# bcrypt — нативный модуль: под alpine пришлось бы ставить тулчейн, здесь
# готовый бинарник для glibc есть в самом пакете.
FROM node:24-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# В build-стадии остаются devDependencies, а в рантайм нужны только
# production-зависимости: dev-пакеты (typescript, tsx) в образ не идут.
FROM build AS prod-deps
WORKDIR /app
RUN npm prune --omit=dev

# --- рантайм ---------------------------------------------------------------
FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NODE_OPTIONS=--enable-source-maps
WORKDIR /app

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
COPY --chown=node:node db/init ./db/init

# О образ в node:24 пользователь node уже есть, но каталог для миграций
# и временных файлов всё равно нужен именно ему.
RUN mkdir -p /app/tmp && chown node:node /app/tmp
USER node

EXPOSE 3000

# CMD, а не ENTRYPOINT: compose переопределяет command у сервиса миграций, а
# ENTRYPOINT перебил бы его и запустил вместо миграций сам сервер. При этом
# node остаётся PID 1 и получает SIGTERM напрямую, поэтому graceful shutdown
# работает (обёртка shell сигнал бы съела).
CMD ["node", "dist/index.js"]