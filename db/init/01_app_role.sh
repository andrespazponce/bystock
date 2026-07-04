#!/bin/bash
# Crea un rol de aplicación con privilegios mínimos.
# Este script es ejecutado automáticamente por el contenedor postgres:16
# la primera vez que se inicializa el volumen de datos.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Rol de aplicación: puede conectar y operar en el schema public,
    -- pero no puede DROP DATABASE ni actuar como superusuario.
    CREATE USER ${APP_DB_USER} WITH PASSWORD '${APP_DB_PASSWORD}';

    GRANT CONNECT ON DATABASE ${POSTGRES_DB} TO ${APP_DB_USER};

    -- USAGE: puede ver objetos del schema.
    -- CREATE: Django necesita crear tablas durante las migraciones.
    GRANT USAGE, CREATE ON SCHEMA public TO ${APP_DB_USER};
EOSQL

echo "Rol '${APP_DB_USER}' creado con privilegios mínimos sobre '${POSTGRES_DB}'."
