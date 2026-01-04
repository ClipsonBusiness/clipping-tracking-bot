# 🔑 Adding API Keys to Railway

## Quick Steps

1. **Go to your Railway project**: https://railway.app
2. **Click on your main service** (the web service, not PostgreSQL/Redis)
3. **Click the "Variables" tab**
4. **Add each variable below**

## Required Environment Variables

### ✅ Auto-Filled (Already Set)
These are automatically set when you add the services:
- `DATABASE_URL` - Set when you add PostgreSQL
- `REDIS_URL` - Set when you add Redis
- `PORT` - Set automatically by Railway

### 🔑 You Need to Add These:

#### 1. YOUTUBE_API_KEY
**Required for:** YouTube video metrics

**How to get it:**
1. Go to https://console.cloud.google.com/
2. Create a project (or select existing)
3. Enable "YouTube Data API v3"
4. Go to "Credentials" → "Create Credentials" → "API Key"
5. Copy the key

**Add to Railway:**
```
YOUTUBE_API_KEY=AIzaSy...your-key-here
```

#### 2. APIFY_API_KEY
**Required for:** TikTok and Instagram scraping

**How to get it:**
1. Go to https://apify.com/
2. Sign up (free tier available)
3. Go to "Settings" → "Integrations" → "API tokens"
4. Copy your API token

**Add to Railway:**
```
APIFY_API_KEY=apify_api_...your-token-here
```

#### 3. SOCIAVAULT_API_KEY
**Required for:** Instagram metrics

**How to get it:**
1. Go to https://sociavault.com/ (or your Instagram API provider)
2. Sign up and get your API key
3. Copy the key

**Add to Railway:**
```
SOCIAVAULT_API_KEY=your-sociavault-key-here
```

#### 4. BASE_URL
**Required for:** OAuth callbacks and webhooks

**How to get it:**
1. After Railway deploys, go to your service → "Settings"
2. Click "Generate Domain" (or use the auto-generated one)
3. Copy the full URL (e.g., `https://your-app.up.railway.app`)

**Add to Railway:**
```
BASE_URL=https://your-app.up.railway.app
```

#### 5. NODE_ENV
**Required for:** Production mode

**Add to Railway:**
```
NODE_ENV=production
```

## Step-by-Step: Adding Variables in Railway

1. **Open Railway Dashboard**
   - Go to https://railway.app
   - Click on your project

2. **Select Your Main Service**
   - Click on the web service (not PostgreSQL or Redis)
   - It should be named something like "clipping-tracking-bot" or "web"

3. **Go to Variables Tab**
   - Click the "Variables" tab at the top
   - You'll see existing variables like `DATABASE_URL` and `REDIS_URL`

4. **Add New Variable**
   - Click "+ New Variable" button
   - Enter the variable name (e.g., `YOUTUBE_API_KEY`)
   - Enter the value (your API key)
   - Click "Add"

5. **Repeat for Each Variable**
   - Add all 5 variables listed above

6. **Redeploy (Automatic)**
   - Railway will automatically redeploy when you add variables
   - Wait for the deployment to complete

## Verification

After adding all variables, check the logs:

1. Go to your service → "Deployments" tab
2. Click on the latest deployment
3. Check the logs for:
   - ✅ `DATABASE_URL: ✅ Set`
   - ✅ `REDIS_URL: ✅ Set`
   - ✅ No errors about missing API keys

## Testing

Once deployed, test your API:

```bash
# Health check
curl https://your-app.up.railway.app/health

# Should return: {"status":"ok","timestamp":"..."}
```

## Troubleshooting

### "API key not valid" errors
- Double-check you copied the entire key (no spaces)
- Make sure the API is enabled in the provider's dashboard
- Wait a few minutes after creating the key (activation delay)

### "Missing environment variable" errors
- Go back to Variables tab
- Verify all variables are added
- Check for typos in variable names (case-sensitive!)
- Redeploy manually if needed

### Variables not showing up
- Make sure you're adding them to the **main service**, not PostgreSQL/Redis
- Click "Redeploy" button if changes don't apply

## Quick Checklist

- [ ] `DATABASE_URL` - Auto-filled ✅
- [ ] `REDIS_URL` - Auto-filled ✅
- [ ] `YOUTUBE_API_KEY` - Add your key
- [ ] `APIFY_API_KEY` - Add your key
- [ ] `SOCIAVAULT_API_KEY` - Add your key
- [ ] `BASE_URL` - Add your Railway URL
- [ ] `NODE_ENV=production` - Add this
- [ ] Deployment completed successfully
- [ ] Health check returns OK

## Need Help Getting API Keys?

- **YouTube**: See `YOUTUBE_API_SETUP.md`
- **Apify**: See `TIKTOK_API_SETUP.md` (has Apify info)
- **SociaVault**: Check their documentation or contact support

