# ✅ Verify Your Railway Deployment

## Step 1: Check Deployment Status

1. **Go to Railway Dashboard:**
   👉 https://railway.app/dashboard

2. **Click on your project** → **Click on your main service**

3. **Check the "Deployments" tab:**
   - Look for the latest deployment
   - Should show "✅ Active" or "✅ Deployed"
   - If it's still building, wait a minute

4. **Check the Logs:**
   - Click on the latest deployment
   - Click "View Logs"
   - Look for:
     - ✅ `Server is running on port X`
     - ✅ `DATABASE_URL: ✅ Set`
     - ✅ `REDIS_URL: ✅ Set` (or warning if not set)
     - ✅ `Database connected successfully`
     - ❌ No errors about missing API keys

## Step 2: Get Your App URL

1. **In Railway:**
   - Go to your service → **"Settings"** tab
   - Click **"Generate Domain"** (if not already done)
   - Copy the URL (e.g., `https://your-app.up.railway.app`)

2. **Or check the "Deployments" tab:**
   - Your URL should be shown there

## Step 3: Test Your App

### Health Check:
```bash
curl https://your-app.up.railway.app/health
```

**Expected response:**
```json
{"status":"ok","timestamp":"2026-01-04T..."}
```

### Or test in browser:
- Open: `https://your-app.up.railway.app/health`
- Should see: `{"status":"ok",...}`

## Step 4: Test the API

### Test YouTube API (if you have YOUTUBE_API_KEY):
```bash
# This should work if API key is set
curl https://your-app.up.railway.app/api/health
```

### Test Frontend:
- Open: `https://your-app.up.railway.app`
- Should see the test UI

## Step 5: Check Environment Variables

1. **In Railway:**
   - Go to your service → **"Variables"** tab
   - Verify all variables are there:
     - ✅ `DATABASE_URL` (auto-filled)
     - ✅ `REDIS_URL` (auto-filled, or warning if not set)
     - ✅ `YOUTUBE_API_KEY`
     - ✅ `APIFY_API_KEY`
     - ✅ `BASE_URL` (your Railway URL)
     - ✅ `NODE_ENV=production`

## Common Issues & Fixes

### ❌ "Application failed to respond"
- **Check logs** for errors
- **Verify** all environment variables are set
- **Wait** for deployment to complete (can take 2-3 minutes)

### ❌ "Database connection failed"
- **Check** `DATABASE_URL` is set correctly
- **Verify** PostgreSQL service is running
- **Check logs** for specific error

### ❌ "Missing API key" errors
- **Go to Variables tab**
- **Verify** `YOUTUBE_API_KEY` and `APIFY_API_KEY` are added
- **Redeploy** if you just added them

### ❌ Health check returns error
- **Check logs** for startup errors
- **Verify** server started successfully
- **Check** if port is correct (Railway sets this automatically)

## Next Steps

Once everything is working:

1. **Test creating a social account:**
   - Go to: `https://your-app.up.railway.app`
   - Try creating a YouTube account
   - Test verification

2. **Test submissions:**
   - Create a submission
   - Check if metrics are being fetched

3. **Monitor logs:**
   - Keep an eye on Railway logs
   - Check for any errors

## 🎉 Success Indicators

You're good to go if:
- ✅ Health check returns `{"status":"ok"}`
- ✅ Logs show "Server is running"
- ✅ Database connected successfully
- ✅ No errors in logs
- ✅ Frontend loads at your Railway URL

