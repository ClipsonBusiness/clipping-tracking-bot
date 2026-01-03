# ⚡ Super Fast Deployment

## 🎯 Easiest Option: Railway (Recommended)

**Deploy everything in 2 minutes:**

1. Go to https://railway.app
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repo
4. Railway will auto-detect and deploy!

**Add services:**
- Click "+ New" → "Database" → "PostgreSQL"
- Click "+ New" → "Database" → "Redis"

**Set environment variables:**
- Go to your service → Variables tab
- Add all your API keys

**Done!** Railway handles everything automatically.

---

## 🚀 One-Command Deploy (Vercel)

```bash
npm run deploy
```

Or manually:
```bash
./deploy.sh
```

---

## 📋 Environment Variables Needed

```
DATABASE_URL=<postgres connection string>
REDIS_URL=<redis connection string>
YOUTUBE_API_KEY=<your key>
APIFY_API_KEY=<your key>
SOCIAVAULT_API_KEY=<your key>
BASE_URL=<your deployment URL>
```

---

## 🏆 Recommendation

**Use Railway** - it's the easiest because:
- ✅ Everything in one place
- ✅ Auto-detects your app
- ✅ Handles database & Redis
- ✅ Supports workers & schedulers
- ✅ Free tier available

**Vercel** is good for API only, but you'll need separate deployment for workers.
