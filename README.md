# Bystock

Sistema de Gestión Corporativo para Bystock.

Este proyecto es una copia adaptada de **corporación_incerpaz** configurada específicamente para las necesidades de Bystock.

## Quick Start

### Desarrollo Local

```bash
# 1. Configurar variables de entorno
cp .env.example .env
# Editar .env con valores reales

# 2. Iniciar servicios con Docker
docker compose up --build -d

# 3. Acceder a la aplicación
# Frontend: http://localhost:5173
# Backend API: http://localhost:8000/api
# Django Admin: http://localhost:8000/admin
```

### Solo Frontend (sin backend)

```bash
cd frontend
npm install
npm run dev
```

## Stack Tecnológico

- **Frontend**: React 18 + Vite + TypeScript
- **Backend**: Django + Django REST Framework + PostgreSQL
- **Infraestructura**: Docker + Docker Compose
- **Deployment Frontend**: Vercel
- **Deployment Backend**: Railway/Render/Heroku (a configurar)

## Estructura del Proyecto

```
bystock/
├── frontend/                # React + Vite SPA
│   ├── src/
│   │   ├── pages/          # Componentes de página
│   │   ├── components/     # Componentes reutilizables
│   │   └── services/       # API calls y servicios
│   ├── package.json
│   └── vite.config.ts
│
├── backend/                 # Django REST API
│   ├── manage.py
│   ├── requirements.txt
│   └── [apps]/             # Django apps
│
├── docker-compose.yml       # Desarrollo local
├── docker-compose.prod.yml  # Producción (referencias)
├── vercel.json              # Configuración Vercel
└── DEPLOYMENT.md            # Guía de deployment
```

## Desarrollo

### Comandos principales

```bash
# Development
npm run dev

# Build
npm run build

# Preview build
npm run preview
```

### Backend

```bash
# Crear migraciones
docker compose exec backend python manage.py makemigrations

# Aplicar migraciones
docker compose exec backend python manage.py migrate

# Crear superusuario
docker compose exec backend python manage.py createsuperuser

# Shell Django
docker compose exec backend python manage.py shell
```

## Deployment

### Frontend en Vercel

1. Conectar repositorio GitHub a Vercel
2. Vercel automáticamente detectará la configuración en `vercel.json`
3. Configurar variable de entorno `VITE_API_URL` en Vercel Dashboard

Ver [DEPLOYMENT.md](./DEPLOYMENT.md) para detalles completos.

### Backend

El backend requiere ser deployado en un servicio separado:
- Railway (recomendado)
- Render
- Heroku
- Google Cloud Run

## Variables de Entorno

Copiar `.env.example` a `.env` y configurar:

- `SECRET_KEY`: Clave secreta de Django
- `POSTGRES_PASSWORD`: Contraseña de base de datos
- `VITE_API_URL`: URL del backend (varía según ambiente)
- Otras variables según tu configuración

## API

El backend proporciona una API REST en `/api/`

- `/api/health/` - Health check
- `/api/token/` - Autenticación JWT
- Endpoints específicos según los modelos Django

## Contributing

1. Crear rama feature: `git checkout -b feature/descripcion`
2. Hacer commits: `git commit -am 'Descripción de cambios'`
3. Push a rama: `git push origin feature/descripcion`
4. Abrir Pull Request

## Soporte

Para issues o preguntas, contactar al equipo de desarrollo.

## Licencia

Uso interno exclusivo para Bystock.
