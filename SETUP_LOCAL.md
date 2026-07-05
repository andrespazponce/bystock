# Setup Local - Bystock

Instrucciones para ejecutar el proyecto localmente durante desarrollo.

## Requisitos

- Python 3.10+
- Node.js 18+
- Git

## Configuración Backend

### 1. Crear entorno virtual

```bash
cd backend
python -m venv venv

# En Linux/Mac:
source venv/bin/activate

# En Windows:
venv\Scripts\activate
```

### 2. Instalar dependencias

```bash
pip install -r requirements.txt
```

### 3. Inicializar base de datos

```bash
python init_db.py
```

Esto creará:
- Estructura de tablas (migraciones)
- Usuarios de prueba
- Empresas, órganos, personas
- Activos y reuniones de ejemplo

**Credenciales de prueba:**
- Admin: `admin` / `admin123`
- Usuario: `usuario` / `usuario123`

### 4. Ejecutar servidor Django

```bash
python manage.py runserver
```

El backend estará en `http://localhost:8000`

---

## Configuración Frontend

### 1. Instalar dependencias

```bash
cd frontend
npm install
```

### 2. Variables de entorno

Crea `frontend/.env.local`:

```env
VITE_API_URL=http://localhost:8000
VITE_GOOGLE_MAPS_API_KEY=tu_clave_aqui
```

### 3. Ejecutar servidor Vite

```bash
npm run dev
```

El frontend estará en `http://localhost:5173`

---

## Acceso a la aplicación

1. Abre `http://localhost:5173` en el navegador
2. No requiere login (auth removido)
3. Navega a **Bienes y Activos** para ver los datos creados

---

## Flujo de desarrollo

### Hacer cambios en el backend

1. Edita el código en `backend/`
2. Si cambias modelos → crea migración:
   ```bash
   python manage.py makemigrations
   python manage.py migrate
   ```
3. El servidor auto-recarga (Ctrl+C y reinicia si hay problemas)

### Hacer cambios en el frontend

1. Edita código en `frontend/src/`
2. Vite auto-recarga en el navegador (HMR)

---

## Estructura de carpetas

```
bystock_clean/
├── backend/
│   ├── manage.py
│   ├── init_db.py           ← Script inicialización DB
│   ├── requirements.txt
│   ├── config/              ← Configuración Django
│   ├── accounts/            ← Usuarios y autenticación
│   ├── core/                ← Modelos base (Empresa, Persona, etc)
│   ├── activos/             ← Módulo de activos/bienes
│   ├── finanzas/            ← Módulo financiero
│   ├── reuniones/           ← Módulo de reuniones
│   └── gobierno/            ← Órganos de gobierno
├── frontend/
│   ├── src/
│   │   ├── pages/           ← Páginas React
│   │   ├── components/      ← Componentes reutilizables
│   │   ├── api/             ← Llamadas a API
│   │   ├── theme/           ← Sistema de temas
│   │   └── App.tsx
│   └── package.json
├── .env                     ← Variables de entorno (local)
└── SETUP_LOCAL.md           ← Este archivo
```

---

## Solucionar problemas

### Error: "No se pudo cargar la lista de activos"

- Verifica que `VITE_API_URL=http://localhost:8000` en `frontend/.env.local`
- Asegúrate que el backend está corriendo (`python manage.py runserver`)
- Revisa la consola del navegador (F12) para más detalles

### Error: "ModuleNotFoundError"

- Activa el entorno virtual: `source venv/bin/activate`
- Reinstala dependencias: `pip install -r requirements.txt`

### Base de datos corrupta

- Elimina `backend/db.sqlite3`
- Ejecuta nuevamente: `python init_db.py`

---

## Próximos pasos

Cuando estés listo para producción:

1. **Backend**: Deployar en Render/Railway (PostgreSQL)
2. **Frontend**: Ya está deployado en Vercel
3. **Base de datos**: Migrar a Supabase PostgreSQL
4. **Actualizar VITE_API_URL**: Usar URL del backend deployado

Ver archivos de configuración Vercel en `vercel.json`
