# Vercel Deployment Guide

## ⚠️ Important Limitations

**Vercel is designed for serverless functions, not long-running processes.**

Your app has:
- ✅ Express API routes → Can work with Vercel
- ❌ BullMQ workers → Need separate deployment
- ❌ Metrics scheduler → Need separate deployment
- ✅ Static frontend → Works great on Vercel

## Deployment Options

### Option 1: Vercel (API only) + Separate Worker Service

**Deploy API to Vercel:**
```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Set environment variables
vercel env add DATABASE_URL
vercel env add REDIS_URL
vercel env add YOUTUBE_API_KEY
vercel env add APIFY_API_KEY
vercel env add SOCIAVAULT_API_KEY
vercel env add BASE_URL
```

**Deploy Workers separately:**
- Use Railway, Render, or Fly.io for workers
- Or use Vercel Cron Jobs (limited to 60s execution)

### Option 2: Full Deployment on Railway (Recommended)

Railway supports:
- ✅ Long-running processes
- ✅ Background workers
- ✅ Schedulers
- ✅ Redis
- ✅ PostgreSQL

**Deploy to Railway:**
1. Go to https://railway.app
2. New Project → Deploy from GitHub
3. Add PostgreSQL database
4. Add Redis
5. Set environment variables
6. Deploy!

### Option 3: Render (Also Good)

Similar to Railway, supports full-stack apps.

## Quick Start: Vercel API Deployment

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Login:**
   ```bash
   vercel login
   ```

3. **Deploy:**
   ```bash
   vercel
   ```

4. **Set Environment Variables:**
   ```bash
   vercel env add DATABASE_URL
   vercel env add REDIS_URL
   vercel env add YOUTUBE_API_KEY
   vercel env add APIFY_API_KEY
   vercel env add SOCIAVAULT_API_KEY
   vercel env add BASE_URL
   ```

5. **Deploy Production:**
   ```bash
   vercel --prod
   ```

## Environment Variables Needed

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `YOUTUBE_API_KEY` - YouTube Data API key
- `APIFY_API_KEY` - Apify API key
- `SOCIAVAULT_API_KEY` - SociaVault API key
- `BASE_URL` - Your Vercel deployment URL

## Database Setup

1. Use Vercel Postgres or external PostgreSQL
2. Run migrations:
   ```bash
   npx prisma migrate deploy
   ```

## Workers & Schedulers

For background jobs, deploy separately:
- **Railway**: Deploy worker service
- **Render**: Deploy worker service
- **Vercel Cron**: Limited to 60s, not ideal for long jobs

## Recommended Architecture

```
┌─────────────┐
│   Vercel    │ → API Routes (serverless)
│  (Frontend) │ → Static files
└─────────────┘
      │
      ├─→ PostgreSQL (Vercel Postgres or external)
      │
      └─→ Redis (Upstash Redis or external)
      
┌─────────────┐
│   Railway   │ → Workers (BullMQ)
│   / Render   │ → Scheduler (cron)
└─────────────┘
```

## Next Steps

1. Choose deployment option
2. Set up database (PostgreSQL)
3. Set up Redis
4. Deploy API
5. Deploy workers separately

