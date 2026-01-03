# 🚂 Railway Deployment - Step by Step

## ⚡ Fast Deployment (5 Steps)

### Step 1: Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-github-repo-url>
git push -u origin main
```

### Step 2: Go to Railway
👉 https://railway.app

### Step 3: Create Project
1. Click **"New Project"**
2. Click **"Deploy from GitHub repo"**
3. Select your repository
4. Railway will auto-detect and start deploying!

### Step 4: Add Database & Redis
1. Click **"+ New"** button
2. Select **"Database"** → **"PostgreSQL"**
3. Click **"+ New"** again
4. Select **"Database"** → **"Redis"**

### Step 5: Set Environment Variables
1. Click on your **main service** (the web service)
2. Go to **"Variables"** tab
3. Add these variables:

```
DATABASE_URL=<auto-filled from PostgreSQL>
REDIS_URL=<auto-filled from Redis>
YOUTUBE_API_KEY=<your-youtube-api-key>
APIFY_API_KEY=<your-apify-api-key>
SOCIAVAULT_API_KEY=<your-sociavault-api-key>
BASE_URL=<your-railway-url>
NODE_ENV=production
PORT=3001
```

**Note:** `DATABASE_URL` and `REDIS_URL` are auto-filled when you add the services!

### ✅ Done!
Railway will automatically:
- Build your app
- Run migrations
- Start the server
- Keep it running 24/7

## 🔍 Check Deployment

1. Go to your service → **"Deployments"** tab
2. Click on the latest deployment
3. Check logs to see if it's running
4. Your app will be at: `https://your-app-name.up.railway.app`

## 🐛 Troubleshooting

**Build fails?**
- Check logs in Railway dashboard
- Make sure all dependencies are in `package.json`

**Database errors?**
- Make sure PostgreSQL service is added
- Check `DATABASE_URL` is set correctly

**Redis errors?**
- Make sure Redis service is added
- Check `REDIS_URL` is set correctly

## 📝 Quick Checklist

- [ ] Code pushed to GitHub
- [ ] Railway project created
- [ ] PostgreSQL added
- [ ] Redis added
- [ ] Environment variables set
- [ ] Deployment successful
- [ ] App is running!

