#!/bin/sh
set -eu

psql \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set=ON_ERROR_STOP=1 \
  --set=app_role="$APP_DB_USER" \
  --set=app_password="$APP_DB_PASSWORD" \
  --set=app_db="$POSTGRES_DB" \
  --file="$(dirname "$0")/11-app-role.psql"
