# 🌐 Deploy via Vercel Web Interface (Easiest!)

## ⚡ Super Fast Steps

### Step 1: Go to Vercel
👉 https://vercel.com/new

### Step 2: Import Your Repo
1. Click **"Import Git Repository"**
2. Search for: `clipping-tracking-bot`
3. Or select: `ClipsonBusiness/clipping-tracking-bot`
4. Click **"Import"**

### Step 3: Configure (Auto-detected!)
Vercel will auto-detect:
- ✅ Framework: Other
- ✅ Build Command: `npm run build`
- ✅ Output Directory: (auto)
- ✅ Install Command: `npm install`

**Just click "Deploy"!**

### Step 4: Wait for Deployment
- Build takes ~2-3 minutes
- Watch the logs in real-time
- You'll get a URL when done!

### Step 5: Set Environment Variables
After deployment:
1. Go to your project dashboard
2. **Settings** → **Environment Variables**
3. Add these:

```
DATABASE_URL=<postgres-url>
REDIS_URL=<redis-url>
YOUTUBE_API_KEY=<your-youtube-api-key>
APIFY_API_KEY=<your-apify-api-key>
SOCIAVAULT_API_KEY=<your-sociavault-api-key>
BASE_URL=<your-vercel-url>
NODE_ENV=production
```

### Step 6: Redeploy
After adding env vars, click **"Redeploy"** button

## ✅ Done!

Your app is live at: `https://your-project.vercel.app`

## 🧪 Test It

Visit: `https://your-project.vercel.app/health`

Should return: `{"status":"ok","timestamp":"..."}`

