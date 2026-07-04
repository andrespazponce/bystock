# Bystock - Deployment Guide

Este proyecto es una copia de **corporación_incerpaz** configurada para Bystock.

## Arquitectura

- **Frontend**: React + Vite (deployable en Vercel)
- **Backend**: Django + PostgreSQL (requiere hosting separado: Railway, Render, Heroku)
- **Infraestructura local**: Docker Compose para desarrollo

## Deployment en Vercel

### 1. Preparar repositorio en GitHub

```bash
git init
git add .
git commit -m "Initial commit: Bystock project"
git branch -M main
git remote add origin https://github.com/tu-usuario/bystock.git
git push -u origin main
```

### 2. Conectar a Vercel

1. Ir a [vercel.com](https://vercel.com)
2. Importar proyecto desde GitHub
3. Seleccionar el repositorio `bystock`
4. Configurar:
   - **Root Directory**: (dejar vacío - raíz del proyecto)
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Output Directory**: `frontend/dist`
   - **Install Command**: `npm install`

### 3. Variables de entorno en Vercel

Agregar en Vercel Dashboard → Settings → Environment Variables:

```
VITE_API_URL=https://tu-backend.railway.app/api
```

## Desarrollo Local

### Setup inicial

```bash
# 1. Copiar variables de entorno
cp .env.example .env

# 2. Levantar servicios con Docker Compose
docker compose up --build -d

# 3. Crear superusuario Django
docker compose exec backend python manage.py createsuperuser

# 4. Acceder a la aplicación
# Frontend: http://localhost:5173
# Backend: http://localhost:8000
# Admin: http://localhost:8000/admin
```

### Desarrollo solo frontend

Si solo trabajas en el frontend sin cambiar el backend:

```bash
cd frontend
npm install
npm run dev
```

## Backend Deployment (Separado)

El backend Django debe deployarse en un servicio diferente. Opciones:

- **Railway** (recomendado)
- **Render**
- **Heroku**
- **Google Cloud Run**

Una vez que el backend está live, actualizar `VITE_API_URL` en variables de entorno de Vercel.

## Estructura de directorios

```
bystock/
├── frontend/           # React + Vite (deploys to Vercel)
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
├── backend/            # Django (deploy separado)
│   ├── manage.py
│   ├── requirements.txt
│   └── ...
├── docker-compose.yml  # Para desarrollo local
├── vercel.json         # Configuración de Vercel
├── .env.example        # Variables de entorno
└── DEPLOYMENT.md       # Este archivo
```

## Troubleshooting

**Error: Cannot find module 'react'**
- Solución: Asegurar que `npm install` se ejecute en el directorio `/frontend`

**Frontend conecta a backend incorrecto**
- Verificar variable `VITE_API_URL` en Vercel
- En desarrollo local, usar `http://localhost:8000/api`

**Build falla en Vercel**
- Revisar logs en Vercel Dashboard
- Asegurar que el comando `npm run build` funciona localmente primero

