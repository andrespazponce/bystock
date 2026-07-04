# Vercel Deployment Guide

## ✅ Prerequisites

- ✅ Project pushed to GitHub (main branch)
- ✅ Vercel account created at https://vercel.com

## Step 1: Import Repository to Vercel

1. Go to https://vercel.com/dashboard
2. Click **"New Project"**
3. Click **"Import Git Repository"**
4. Select **"GitHub"** as the provider
5. Search for and select **"bystock"** repository

## Step 2: Configure Project Settings

Vercel should auto-detect these settings:

```
Framework Preset:        Other
Build Command:          cd frontend && npm install && npm run build
Output Directory:       frontend/dist
Install Command:        npm install
Root Directory:         (leave empty)
```

✅ If these are already set correctly, click **"Deploy"**

## Step 3: Set Environment Variables

After import, go to **Settings → Environment Variables** and add:

```
VITE_API_URL = https://your-backend-api-url.com/api
```

**Note:** Replace `your-backend-api-url.com/api` with your actual backend URL once it's deployed.

## Step 4: Deploy

1. If environment variables are set: Click **"Deploy"**
2. Wait for build to complete (~2-3 minutes first time)
3. Your site will be live at: `https://bystock-[random].vercel.app`

## Updating Backend URL Later

Once your backend is live on Railway/Render/etc:

1. Go to Vercel Dashboard → bystock → Settings → Environment Variables
2. Update `VITE_API_URL` with your backend URL
3. Vercel will automatically redeploy with new URL

## Troubleshooting

### Build fails with "Cannot find module"
- Check that `npm install` runs in `/frontend` directory
- Verify all dependencies are listed in `frontend/package.json`
- Check Vercel build logs for specific errors

### Frontend loads but API calls fail
- Verify `VITE_API_URL` environment variable is set
- Check backend is running and accessible
- Check browser console for CORS errors

### Deployment takes too long
- First deploy is slower (installing dependencies)
- Subsequent deploys are faster
- Check Vercel build logs if it times out

## Custom Domain (Optional)

1. Go to Vercel Dashboard → bystock → Settings → Domains
2. Add your custom domain
3. Follow DNS setup instructions

## Automatic Deployments

By default, every push to `main` branch triggers automatic deployment.

To disable or change:
1. Go to Vercel Dashboard → bystock → Settings → Git
2. Configure branch deployment rules

---

**Need help?** Check DEPLOYMENT.md for more details.
