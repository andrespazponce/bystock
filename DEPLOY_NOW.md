# 🚀 BYSTOCK - DEPLOY TO VERCEL (Copy & Paste)

**El proyecto está 100% listo. Solo necesitas copiar y pegar estos comandos en tu terminal.**

---

## ⚡ OPCIÓN RÁPIDA (Si tienes GitHub CLI + Vercel CLI)

### 1. Instalar CLIs (si no los tienes)
```bash
# GitHub CLI
brew install gh  # macOS
# o descarga desde https://cli.github.com/

# Vercel CLI
npm install -g vercel
```

### 2. Autenticarse
```bash
gh auth login
vercel login
```

### 3. COPIAR Y PEGAR ESTO COMPLETO (todo junto):
```bash
cd /ruta/a/bystock_final

# Initialize Git
git init
git config user.email "andrespazponce@gmail.com"
git config user.name "Andres Paz"
git add .
git commit -m "Initial commit: Bystock project"
git branch -M main

# Create GitHub repo and push
gh repo create bystock --public --source=. --remote=origin --push

# Deploy to Vercel
vercel --prod
```

**Eso es. Tu sitio estará live en ~3 minutos. ✨**

---

## 📋 OPCIÓN MANUAL (Sin GitHub CLI)

### 1. Inicializar Git localmente
```bash
cd /ruta/a/bystock_final

git init
git config user.email "andrespazponce@gmail.com"
git config user.name "Andres Paz"
git add .
git commit -m "Initial commit: Bystock project"
git branch -M main
```

### 2. Crear repositorio en GitHub
1. Ve a: https://github.com/new
2. **Nombre:** `bystock`
3. **Tipo:** Public
4. **NO marques:** "Initialize with README"
5. Click **"Create repository"**

### 3. Pushear código
```bash
git remote add origin https://github.com/TU_USERNAME/bystock.git
git push -u origin main
```

### 4. Deploy a Vercel
```bash
npm install -g vercel
vercel login
vercel --prod
```

**Tu sitio estará live. ✨**

---

## ⚙️ DESPUÉS DEL DEPLOYMENT (5 minutos)

### Verificar que Vercel detectó todo correctamente

1. Ve a: https://vercel.com/dashboard
2. Selecciona proyecto `bystock`
3. Debe mostrar:
   - **Build Command:** `cd frontend && npm install && npm run build`
   - **Output:** `frontend/dist`
   - **Status:** ✅ Success

Si ves esto, Vercel lo detectó automáticamente de `vercel.json`.

### Configurar variable de entorno (Temporal)

**Por ahora, usa esto como placeholder:**

```
VITE_API_URL = https://api.placeholder.com
```

1. Ve a: Settings → Environment Variables
2. Add:
   - **Name:** `VITE_API_URL`
   - **Value:** `https://api.placeholder.com`
3. Click **Save**

Vercel va a redeploy automáticamente.

---

## 🔗 TU URL LIVE

Después que Vercel finalize, tu sitio está en:
```
https://bystock-[random-id].vercel.app
```

Ves exactamente dónde en el Dashboard de Vercel.

---

## 📱 Desarrollo Local (Opcional pero IMPORTANTE)

Para testing local antes de hacer cambios:

```bash
cd /ruta/a/bystock_final

# Setup
cp .env.example .env

# Docker (necesitas Docker Desktop instalado)
docker compose up --build -d

# Acceder:
# Frontend: http://localhost:5173
# Backend:  http://localhost:8000
# Admin:    http://localhost:8000/admin
```

---

## 🎯 Próximo paso: Backend

Una vez que el frontend esté live, necesitas deployar el backend.

### Opción A: Railway (RECOMENDADO)
1. https://railway.app
2. Deploy → GitHub → Select `bystock`
3. Seleccionar carpeta: `backend`
4. Verá `requirements.txt` automáticamente
5. Click **Deploy**
6. Copiar URL (ej: `https://bystock-api.railway.app`)

### Opción B: Render
Similar a Railway. Busca "Django" template.

### Opción C: Heroku
```bash
heroku create bystock-api
git push heroku main
```

---

## 🔗 Conectar Frontend ↔ Backend

Una vez que backend esté live:

1. Copia URL del backend (ej: `https://bystock-api.railway.app`)
2. Ve a Vercel Dashboard → `bystock` → Settings → Environment Variables
3. Edita `VITE_API_URL`:
   ```
   VITE_API_URL = https://bystock-api.railway.app/api
   ```
4. Save → Vercel redeploy automáticamente

**Frontend y Backend conectados. ✅**

---

## 🆘 Si algo falla

### Build error en Vercel
- Click en el deployment fallido en Vercel Dashboard
- Revisa "Build Logs"
- Típicamente es un problema con npm install

**Solución:** Verifica que `package.json` en `frontend/` existe y es válido.

### Frontend carga pero API falla
- Verifica `VITE_API_URL` en Vercel Environment Variables
- Asegúrate que backend está activo
- Revisa browser console (F12) para CORS errors

### CORS errors
En `backend/settings.py`, actualiza:
```python
ALLOWED_HOSTS = ['*']
CORS_ALLOWED_ORIGINS = [
    "https://bystock-*.vercel.app",
    "http://localhost:3000",
]
```

---

## ✅ CHECKLIST FINAL

- [ ] Git initialized locally
- [ ] Code pushed to GitHub `main` branch
- [ ] Vercel shows "Success" deployment
- [ ] Frontend accessible en `*.vercel.app`
- [ ] Environment variable `VITE_API_URL` set (even if placeholder)
- [ ] Backend deployed (Railway/Render/Heroku)
- [ ] Backend URL updated in Vercel env var
- [ ] API calls working (test en browser console)

---

## 📞 Listo para hacer cambios

Una vez todo deployado:

1. **Local changes:** Edita código → commit → git push
2. **Vercel auto-deploys** en push a `main`
3. **Live en ~30-60 segundos**

Workflow rápido:
```bash
# Hacer un cambio
nano frontend/src/pages/SomePage.tsx

# Commit
git add .
git commit -m "Update SomePage"
git push

# ✨ Vercel deploys automáticamente
# Tu cambio está live en tu URL en 30 segundos
```

---

## 🎉 LISTO

El proyecto está completamente preparado. No hay más pasos de setup.

Solo ejecuta los comandos arriba y estarás live en Vercel. 🚀

¿Preguntas? Revisa `DEPLOYMENT.md` para troubleshooting.
