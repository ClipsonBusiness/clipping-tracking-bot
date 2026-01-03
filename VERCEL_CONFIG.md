# ⚙️ Vercel Configuration Settings

## What to Set:

### ✅ Already Correct:
- **Framework Preset:** Express ✅
- **Root Directory:** `./` ✅
- **Install Command:** `npm install` ✅

### 🔧 Set These:

**Build Command:**
```
npm run build
```

**Output Directory:**
```
dist
```
(Or leave as N/A - Vercel will auto-detect)

**Environment Variables:**
- Skip for now (we'll add after deployment)
- Or add them now if you want:
  - `DATABASE_URL` (we'll get this from PostgreSQL)
  - `REDIS_URL` (we'll get this from Redis)
  - `YOUTUBE_API_KEY`
  - `APIFY_API_KEY`
  - `SOCIAVAULT_API_KEY`
  - `BASE_URL` (will be your Vercel URL)
  - `NODE_ENV=production`

## After Configuration:

1. Click **"Deploy"** button
2. Wait for build to complete (~2-3 minutes)
3. You'll get a URL like: `https://your-project.vercel.app`
4. Then add environment variables in Settings

## ⚠️ Important:

The **Build Command** is critical - it runs:
- `prisma generate` (generates Prisma client)
- `tsc` (compiles TypeScript)

Make sure it's set to: `npm run build`

