# Quick Vercel Deployment

## ⚠️ Important Note

Vercel is **serverless** - it doesn't support:
- Long-running workers (BullMQ)
- Background schedulers
- Persistent connections

**Your workers/schedulers need separate deployment** (Railway, Render, etc.)

## Deploy API to Vercel

### Step 1: Install Vercel CLI
```bash
npm i -g vercel
```

### Step 2: Login
```bash
vercel login
```

### Step 3: Deploy
```bash
vercel
```

### Step 4: Set Environment Variables
In Vercel dashboard or CLI:
```bash
vercel env add DATABASE_URL
vercel env add REDIS_URL
vercel env add YOUTUBE_API_KEY
vercel env add APIFY_API_KEY
vercel env add SOCIAVAULT_API_KEY
vercel env add BASE_URL
```

### Step 5: Deploy Production
```bash
vercel --prod
```

## Database Setup

1. **Use Vercel Postgres** (recommended):
   - Go to Vercel dashboard
   - Add Postgres database
   - Copy connection string to `DATABASE_URL`

2. **Or use external PostgreSQL**:
   - Railway, Supabase, Neon, etc.
   - Set `DATABASE_URL` in Vercel env vars

3. **Run migrations**:
   ```bash
   npx prisma migrate deploy
   ```

## Redis Setup

1. **Use Upstash Redis** (recommended for Vercel):
   - Go to https://upstash.com
   - Create Redis database
   - Copy connection string to `REDIS_URL`

2. **Or use external Redis**:
   - Railway, Render, Redis Cloud, etc.

## Workers Deployment

Since Vercel doesn't support workers, deploy separately:

### Option A: Railway (Recommended)
1. Go to https://railway.app
2. New Project → Deploy from GitHub
3. Select your repo
4. Add environment variables
5. Deploy!

### Option B: Render
1. Go to https://render.com
2. New Web Service
3. Connect GitHub repo
4. Set environment variables
5. Deploy!

## Architecture

```
┌─────────────┐
│   Vercel    │ → API Routes (serverless)
│             │ → Frontend (static)
└─────────────┘
      │
      ├─→ PostgreSQL
      └─→ Redis
      
┌─────────────┐
│   Railway   │ → Workers (BullMQ)
│   / Render   │ → Scheduler (cron)
└─────────────┘
```

## Troubleshooting

- **Build fails**: Check `vercel-build` script in package.json
- **Database errors**: Ensure `DATABASE_URL` is set correctly
- **Redis errors**: Ensure `REDIS_URL` is set correctly
- **API timeout**: Increase function timeout in vercel.json

## Next Steps

1. Deploy API to Vercel ✅
2. Set up PostgreSQL database
3. Set up Redis
4. Deploy workers separately
5. Test!

