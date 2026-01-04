# 🔗 Direct Links for Railway Setup

## Step 1: Go to Railway Dashboard
👉 **https://railway.app/dashboard**

## Step 2: Select Your Project
- Click on your project (or create one if you haven't)

## Step 3: Click on Your Main Service
- Click on the web service (usually named "clipping-tracking-bot" or similar)
- **NOT** PostgreSQL or Redis services

## Step 4: Go to Variables Tab
- Click the **"Variables"** tab at the top
- You'll see a list of existing variables

## Step 5: Add Variables
Click **"+ New Variable"** and add each one:

### Required Variables to Add:

1. **YOUTUBE_API_KEY**
   - Get key from: https://console.cloud.google.com/apis/credentials
   - Enable API: https://console.cloud.google.com/apis/library/youtube.googleapis.com

2. **APIFY_API_KEY**
   - Get token from: https://console.apify.com/account/integrations
   - Sign up: https://apify.com/

3. **SOCIAVAULT_API_KEY**
   - Get from your Instagram API provider
   - Or use alternative Instagram API service

4. **BASE_URL**
   - Your Railway app URL (e.g., `https://your-app.up.railway.app`)
   - Find it in: Railway → Your Service → Settings → Generate Domain

5. **NODE_ENV**
   - Value: `production`

---

## Quick Checklist:

- [ ] Go to https://railway.app/dashboard
- [ ] Click your project
- [ ] Click your main web service
- [ ] Click "Variables" tab
- [ ] Add `YOUTUBE_API_KEY`
- [ ] Add `APIFY_API_KEY`
- [ ] Add `SOCIAVAULT_API_KEY`
- [ ] Add `BASE_URL` (your Railway URL)
- [ ] Add `NODE_ENV=production`
- [ ] Wait for auto-redeploy

---

## Get Your API Keys:

### YouTube API Key:
1. Go to: https://console.cloud.google.com/
2. Create/select project
3. Enable API: https://console.cloud.google.com/apis/library/youtube.googleapis.com
4. Get key: https://console.cloud.google.com/apis/credentials

### Apify API Token:
1. Go to: https://apify.com/
2. Sign up/login
3. Go to: https://console.apify.com/account/integrations
4. Copy API token

### Your Railway URL (for BASE_URL):
1. Go to: https://railway.app/dashboard
2. Click your service
3. Go to "Settings" tab
4. Click "Generate Domain" (or copy existing domain)
5. Copy the full URL (e.g., `https://your-app.up.railway.app`)

