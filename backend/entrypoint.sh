#!/bin/sh
set -e

echo "Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT}..."
python - <<'EOF'
import socket, time, os, sys

host = os.environ.get("DB_HOST", "db")
port = int(os.environ.get("DB_PORT", "5432"))
retries = 30

for i in range(retries):
    try:
        s = socket.create_connection((host, port), timeout=2)
        s.close()
        print(f"PostgreSQL is ready ({host}:{port})")
        sys.exit(0)
    except (socket.error, OSError):
        print(f"Attempt {i+1}/{retries} — not ready yet, retrying...")
        time.sleep(2)

print("ERROR: PostgreSQL did not become ready in time.")
sys.exit(1)
EOF

echo "Running migrations..."
python manage.py migrate --noinput

echo "Starting development server..."
exec python manage.py runserver 0.0.0.0:8000
