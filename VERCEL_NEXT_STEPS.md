# ✅ Vercel Deployment - Next Steps

## Step 1: Check Your Deployment
Your app should be live at: `https://your-project.vercel.app`

Check if it's working:
```bash
curl https://your-project.vercel.app/health
```

## Step 2: Set Environment Variables (CRITICAL!)

Go to: https://vercel.com/dashboard
1. Click on your project
2. Go to **Settings** → **Environment Variables**
3. Add these variables:

### Required Variables:
```
DATABASE_URL=<your-postgres-connection-string>
REDIS_URL=<your-redis-connection-string>
YOUTUBE_API_KEY=<your-youtube-api-key>
APIFY_API_KEY=<your-apify-api-key>
SOCIAVAULT_API_KEY=<your-sociavault-api-key>
BASE_URL=https://your-project.vercel.app
NODE_ENV=production
```

**After adding variables, redeploy!** (Vercel will auto-redeploy)

## Step 3: Set Up Database

### Option A: Vercel Postgres (Easiest)
1. In Vercel dashboard → Your project
2. Go to **Storage** tab
3. Click **"Create Database"** → **PostgreSQL**
4. Copy the `POSTGRES_URL` → Use as `DATABASE_URL`

### Option B: External PostgreSQL
- Supabase (free tier available)
- Neon (free tier available)
- Railway PostgreSQL
- Copy connection string → Use as `DATABASE_URL`

## Step 4: Set Up Redis

### Option A: Upstash Redis (Recommended for Vercel)
1. Go to https://upstash.com
2. Create Redis database
3. Copy connection string → Use as `REDIS_URL`

### Option B: External Redis
- Railway Redis
- Render Redis
- Redis Cloud
- Copy connection string → Use as `REDIS_URL`

## Step 5: Run Database Migrations

After `DATABASE_URL` is set, run migrations:

```bash
# In Vercel dashboard, go to your deployment
# Or use Vercel CLI:
vercel env pull .env.local
npx prisma migrate deploy
```

Or add this to your Vercel build command (already done in vercel-build script).

## Step 6: Deploy Workers Separately

Since Vercel doesn't support workers, deploy them on Railway:

1. Go to https://railway.app
2. New Project → Deploy from GitHub
3. Select same repo
4. Add same `DATABASE_URL` and `REDIS_URL`
5. Set start command: `npm start` (or create separate worker entry point)

## ✅ Quick Checklist

- [ ] Deployment successful
- [ ] Environment variables set
- [ ] PostgreSQL connected
- [ ] Redis connected
- [ ] Migrations run
- [ ] Workers deployed separately
- [ ] Test API endpoints

## 🧪 Test Your Deployment

```bash
# Health check
curl https://your-project.vercel.app/health

# Test API (with auth headers)
curl -H "x-user-id: test-user-123" -H "x-user-role: CLIPPER" \
  https://your-project.vercel.app/api/social-accounts/youtube
```

## 🎯 You're Done!

Your API is live! 🚀

