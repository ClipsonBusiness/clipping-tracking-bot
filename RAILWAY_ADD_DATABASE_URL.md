# 🔧 Add DATABASE_URL to Your Service

## The Problem:
Your service can't see `DATABASE_URL` even though it's in Shared Variables.

## The Solution:
Add `DATABASE_URL` directly to your **service's Variables** tab.

---

## Step-by-Step:

### 1. Go to Your Service
1. Go to: https://railway.app/dashboard
2. Click **"bountiful-healing"** project
3. Click **"Architecture"** tab (top navigation)
4. Click on **"clipping-tracking-api"** service card

### 2. Go to Variables Tab
- Click **"Variables"** tab at the top

### 3. Add DATABASE_URL
1. Click **"+ New Variable"** button
2. **Variable Name:** `DATABASE_URL`
3. **Variable Value:** Copy from Shared Variables:
   ```
   postgresql://postgres:zWciIttqQKvejzFAsgytQBaADsCvYmbg@postgres.railway.internal:5432/railway
   ```
   (Or get it from: Project Settings → Shared Variables → Copy the DATABASE_URL value)
4. Click **"Add"**

### 4. Add Other Required Variables
While you're there, also add:
- `YOUTUBE_API_KEY` = (your YouTube API key)
- `APIFY_API_KEY` = (your Apify API key)
- `BASE_URL` = `https://your-app.up.railway.app` (your Railway URL)
- `NODE_ENV` = `production`

### 5. Wait for Redeploy
- Railway will automatically redeploy
- Check "Deployments" tab
- Wait for "✅ Active"

---

## Verify It's Set:

1. **In Variables tab**, you should see:
   - ✅ `DATABASE_URL` listed
   - ✅ Value is visible (or masked)

2. **Check Logs** after redeploy:
   - Go to Deployments → Latest → View Logs
   - Look for: `DATABASE_URL: ✅ Set`
   - Look for: `Database connected successfully`

---

## Quick Checklist:

- [ ] Go to Architecture tab
- [ ] Click "clipping-tracking-api" service
- [ ] Click "Variables" tab
- [ ] Add `DATABASE_URL` with the PostgreSQL connection string
- [ ] Add `YOUTUBE_API_KEY`
- [ ] Add `APIFY_API_KEY`
- [ ] Add `BASE_URL`
- [ ] Add `NODE_ENV=production`
- [ ] Wait for redeploy
- [ ] Test health endpoint

---

## The Connection String Format:

Your `DATABASE_URL` should look like:
```
postgresql://postgres:password@host:5432/database
```

Or for Railway internal:
```
postgresql://postgres:password@postgres.railway.internal:5432/railway
```

**Important:** Must start with `postgresql://` or `postgres://` ✅

