# 🔑 Your API Keys - Where to Find Them

## ⚠️ I Cannot Access Your API Keys
Your API keys are stored securely in:
- Your local `.env` file (not in git)
- Railway environment variables (secure)

I cannot and should not access them for security reasons.

---

## 📍 Where to Find Your Keys:

### 1. **YOUTUBE_API_KEY**
**If you already have one:**
- Check your local `.env` file
- Or check Railway → Your Service → Variables tab

**If you need a new one:**
- Go to: https://console.cloud.google.com/apis/credentials
- Create/select project
- Enable: https://console.cloud.google.com/apis/library/youtube.googleapis.com
- Create API Key

### 2. **APIFY_API_KEY**
**If you already have one:**
- Check your local `.env` file
- Or check Railway → Your Service → Variables tab

**If you need a new one:**
- Go to: https://console.apify.com/account/integrations
- Sign up/login: https://apify.com/
- Copy your API token

### 3. **SOCIAVAULT_API_KEY** ⚠️ **OPTIONAL**
**Status:** Mostly disabled in code - **NOT REQUIRED**

Looking at the code:
- It's only used as a fallback for Instagram username extraction
- The main SociaVault endpoint is **disabled** (`if (false && ...)`)
- **You can skip this** if you're not using Instagram features heavily

**If you want to add it anyway:**
- Go to: https://sociavault.com/
- Sign up and get API key
- But it's **not critical** - app works without it

---

## ✅ Quick Check:

1. **Check your local `.env` file:**
   ```bash
   cat .env
   ```
   (Look for YOUTUBE_API_KEY and APIFY_API_KEY)

2. **Check Railway:**
   - Go to: https://railway.app/dashboard
   - Click your service → Variables tab
   - See what's already there

---

## 🎯 What You Actually Need:

**REQUIRED:**
- ✅ `YOUTUBE_API_KEY` - For YouTube metrics
- ✅ `APIFY_API_KEY` - For TikTok/Instagram scraping

**OPTIONAL:**
- ⚠️ `SOCIAVAULT_API_KEY` - Only if you need Instagram username fallback (mostly disabled anyway)

**AUTO-SET:**
- ✅ `DATABASE_URL` - Railway sets this
- ✅ `REDIS_URL` - Railway sets this

---

## 💡 If You Don't Have Keys:

### Get YouTube API Key (5 minutes):
1. https://console.cloud.google.com/
2. Create project
3. Enable YouTube Data API v3
4. Create API Key
5. Copy it

### Get Apify Token (5 minutes):
1. https://apify.com/ (sign up free)
2. https://console.apify.com/account/integrations
3. Copy API token

### Skip SociaVault:
- It's optional and mostly disabled
- You can add it later if needed

