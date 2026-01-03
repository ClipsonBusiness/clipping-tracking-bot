# 🚀 Super Fast Deployment

## Option 1: One-Command Deploy (Easiest!)

```bash
chmod +x deploy.sh && ./deploy.sh
```

That's it! The script will:
- Install Vercel CLI if needed
- Login if needed
- Deploy to production

## Option 2: Railway (Recommended - Everything in One Place!)

Railway is **easier** because it supports everything:
- ✅ API
- ✅ Workers
- ✅ Schedulers
- ✅ Database
- ✅ Redis

**Deploy in 2 minutes:**

1. Go to https://railway.app
2. Click "New Project"
3. Click "Deploy from GitHub repo"
4. Select your repo
5. Add these services:
   - **PostgreSQL** (database)
   - **Redis** (for BullMQ)
6. Set environment variables:
   ```
   DATABASE_URL=<from PostgreSQL service>
   REDIS_URL=<from Redis service>
   YOUTUBE_API_KEY=<your key>
   APIFY_API_KEY=<your key>
   SOCIAVAULT_API_KEY=<your key>
   BASE_URL=<your railway URL>
   ```
7. Deploy!

**That's it!** Railway handles everything automatically.

## Option 3: Vercel (API Only)

### Quick Deploy:
```bash
npm i -g vercel
vercel login
vercel --prod
```

### Set Environment Variables:
Go to Vercel dashboard → Your project → Settings → Environment Variables

Add:
- `DATABASE_URL`
- `REDIS_URL`
- `YOUTUBE_API_KEY`
- `APIFY_API_KEY`
- `SOCIAVAULT_API_KEY`
- `BASE_URL`

## Which Should You Choose?

| Platform | API | Workers | Database | Redis | Difficulty |
|----------|-----|---------|----------|-------|------------|
| **Railway** | ✅ | ✅ | ✅ | ✅ | ⭐ Easy |
| **Render** | ✅ | ✅ | ✅ | ✅ | ⭐ Easy |
| **Vercel** | ✅ | ❌ | ✅ | ✅ | ⭐⭐ Medium |

**Recommendation: Use Railway** - it's the easiest and supports everything!

