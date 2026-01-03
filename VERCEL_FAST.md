# ⚡ Super Fast Vercel Deployment

## 🚀 One-Command Deploy

```bash
npm run deploy
```

Or:
```bash
./deploy.sh
```

## 📋 Manual Steps (2 minutes)

### Step 1: Install & Login
```bash
npm i -g vercel
vercel login
```

### Step 2: Deploy
```bash
vercel --prod
```

### Step 3: Set Environment Variables
Go to Vercel Dashboard → Your Project → Settings → Environment Variables

Add these:
```
DATABASE_URL=<your-postgres-url>
REDIS_URL=<your-redis-url>
YOUTUBE_API_KEY=<your-key>
APIFY_API_KEY=<your-key>
SOCIAVAULT_API_KEY=<your-key>
BASE_URL=<your-vercel-url>
NODE_ENV=production
```

## ⚠️ Important Notes

**Vercel is serverless** - it doesn't support:
- ❌ Long-running workers (BullMQ)
- ❌ Background schedulers
- ❌ Persistent connections

**You'll need to deploy workers separately:**
- Railway (recommended)
- Render
- Fly.io

## 🏗️ Architecture

```
Vercel (API + Frontend)
  ├─→ PostgreSQL (Vercel Postgres or external)
  └─→ Redis (Upstash or external)

Railway/Render (Workers)
  ├─→ Same PostgreSQL
  └─→ Same Redis
```

## ✅ Quick Checklist

- [ ] Code pushed to GitHub
- [ ] Vercel CLI installed
- [ ] Logged in to Vercel
- [ ] Deployed to Vercel
- [ ] Environment variables set
- [ ] Database connected
- [ ] Redis connected
- [ ] Workers deployed separately

## 🎯 That's It!

Your API will be live at: `https://your-project.vercel.app`

