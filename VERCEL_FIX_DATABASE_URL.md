# 🔧 Fix Vercel DATABASE_URL Error

## Quick Fix (2 minutes)

The error `"DATABASE_URL environment variable is not configured"` means you need to add your database connection string to Vercel.

### Step 1: Get Your Database URL

**If using Railway PostgreSQL:**
1. Go to https://railway.app
2. Click your PostgreSQL service
3. Go to **Variables** tab
4. Copy `DATABASE_PUBLIC_URL` or `DATABASE_URL`

**If using Vercel Postgres:**
1. Go to Vercel dashboard → Your project
2. Go to **Storage** tab
3. Click your PostgreSQL database
4. Copy the connection string

**If using other providers:**
- Supabase: Project Settings → Database → Connection String
- Neon: Dashboard → Connection String
- Any PostgreSQL: `postgresql://user:password@host:port/database`

### Step 2: Add to Vercel

1. Go to https://vercel.com/dashboard
2. Click your project: **clipping-tracking-bot**
3. Go to **Settings** → **Environment Variables**
4. Click **"Add New"**
5. Add:
   - **Key:** `DATABASE_URL`
   - **Value:** (paste your database connection string)
   - **Environment:** Production, Preview, Development (check all)
6. Click **"Save"**

### Step 3: Redeploy

After adding the variable:
1. Go to **Deployments** tab
2. Click the **"⋯"** menu on the latest deployment
3. Click **"Redeploy"**
4. Wait for deployment to complete (~2 minutes)

### Step 4: Verify

Visit: `https://clipping-tracking-bot.vercel.app/health`

Should return: `{"status":"ok","timestamp":"..."}`

## ✅ Done!

Your Vercel deployment should now work. The app will connect to your database when needed.

## Other Environment Variables You Might Need

If you get other errors, also add:
- `REDIS_URL` (if using Redis)
- `YOUTUBE_API_KEY`
- `APIFY_API_KEY`
- `SOCIAVAULT_API_KEY`
- `BASE_URL` (your Vercel URL)
- `NODE_ENV=production`

