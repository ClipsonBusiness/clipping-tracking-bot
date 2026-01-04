# 🔧 Fix: DATABASE_URL Not Found (503 Error)

## The Problem:
You added variables to **"Shared Variables"** but your service isn't seeing them.

## The Solution:
Railway has two places for variables:
1. **Shared Variables** (project level) - Need to be referenced
2. **Service Variables** (service level) - Direct access

---

## Quick Fix (Choose One):

### Option 1: Add Variables to Your Service (Easiest) ✅

1. **Go to Railway Dashboard:**
   👉 https://railway.app/dashboard

2. **Click on your MAIN SERVICE** (not project settings)
   - The web service (not PostgreSQL or Redis)

3. **Click "Variables" tab**

4. **Add these variables directly:**
   - `DATABASE_URL` - Copy from PostgreSQL service
   - `REDIS_URL` - Copy from Redis service (if you have it)
   - `YOUTUBE_API_KEY` - Your key
   - `APIFY_API_KEY` - Your key
   - `BASE_URL` - Your Railway URL
   - `NODE_ENV=production`

5. **How to get DATABASE_URL:**
   - Click on your **PostgreSQL service**
   - Go to **"Variables"** tab
   - Copy the `DATABASE_URL` value
   - Paste it into your main service's variables

6. **Railway will auto-redeploy** ✅

---

### Option 2: Reference Shared Variables

If you want to use Shared Variables, you need to reference them:

1. **Go to your main service** → **Variables** tab
2. **Add variable:**
   - Name: `DATABASE_URL`
   - Value: `${{PostgreSQL.DATABASE_URL}}`
   - (Replace `PostgreSQL` with your actual PostgreSQL service name)

But **Option 1 is easier!** ✅

---

## Step-by-Step: Add to Service Variables

### 1. Get DATABASE_URL from PostgreSQL:
- Click **PostgreSQL service** → **Variables** tab
- Copy the `DATABASE_URL` value
- It looks like: `postgresql://postgres:password@host:5432/railway`

### 2. Add to Main Service:
- Click **your main service** (web service)
- Click **"Variables"** tab
- Click **"+ New Variable"**
- Name: `DATABASE_URL`
- Value: (paste the PostgreSQL DATABASE_URL)
- Click **"Add"**

### 3. Add Other Variables:
Repeat for:
- `REDIS_URL` (from Redis service, if you have it)
- `YOUTUBE_API_KEY` (your key)
- `APIFY_API_KEY` (your key)
- `BASE_URL` (your Railway URL)
- `NODE_ENV=production`

### 4. Wait for Redeploy:
- Railway will automatically redeploy
- Check "Deployments" tab
- Wait for "✅ Active"

---

## Verify It's Working:

1. **Check Logs:**
   - Go to your service → Deployments → Latest → View Logs
   - Look for: `DATABASE_URL: ✅ Set`
   - Look for: `Database connected successfully`

2. **Test Health Endpoint:**
   ```
   https://your-app.up.railway.app/health
   ```
   Should return: `{"status":"ok",...}`

3. **Test API:**
   - Try verifying an account again
   - Should work now!

---

## Why This Happened:

- **Shared Variables** are project-level
- Services need to either:
  - Have variables directly (Option 1 - easier)
  - Reference shared variables with `${{ServiceName.VARIABLE}}` (Option 2)

**Option 1 is recommended** - just add variables directly to your service! ✅

---

## Quick Checklist:

- [ ] Go to main service (not project settings)
- [ ] Click "Variables" tab
- [ ] Get `DATABASE_URL` from PostgreSQL service
- [ ] Add `DATABASE_URL` to main service
- [ ] Add `YOUTUBE_API_KEY`
- [ ] Add `APIFY_API_KEY`
- [ ] Add `BASE_URL`
- [ ] Add `NODE_ENV=production`
- [ ] Wait for redeploy
- [ ] Test health endpoint
- [ ] Test account verification

