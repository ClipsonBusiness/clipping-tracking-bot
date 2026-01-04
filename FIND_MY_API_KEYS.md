# 🔑 Where to Find Your API Keys

## ⚠️ I Cannot Access Your Keys
Your API keys are stored securely and I don't have access to them. Here's where YOU can find them:

---

## 1. Check Your Local .env File

**On your computer:**
```bash
cat .env
```

Look for:
- `YOUTUBE_API_KEY=...`
- `APIFY_API_KEY=...`

---

## 2. Check Railway Variables

**In Railway:**
1. Go to: https://railway.app/dashboard
2. Click your project → Your service → "Variables" tab
3. Look for your API keys (they'll be masked with `********`)

**To see the value:**
- Click the eye icon next to the variable
- Or click the variable name to edit/view

---

## 3. Check Shared Variables

**In Railway:**
1. Go to: Project Settings → Shared Variables
2. Look for your API keys there

---

## 4. If You Don't Have Keys Yet

### Get YouTube API Key (5 minutes):

1. **Go to Google Cloud Console:**
   👉 https://console.cloud.google.com/apis/credentials

2. **Create/Select Project:**
   - Click project dropdown
   - Create new or select existing

3. **Enable YouTube Data API:**
   👉 https://console.cloud.google.com/apis/library/youtube.googleapis.com
   - Click "Enable"

4. **Create API Key:**
   - Go to: https://console.cloud.google.com/apis/credentials
   - Click "Create Credentials" → "API Key"
   - Copy the key

5. **Add to Railway:**
   - Go to your service → Variables
   - Add: `YOUTUBE_API_KEY` = (paste your key)

---

### Get Apify API Token (5 minutes):

1. **Sign up/Login:**
   👉 https://apify.com/
   - Create account (free tier available)

2. **Get API Token:**
   👉 https://console.apify.com/account/integrations
   - Go to "API tokens" section
   - Copy your token

3. **Add to Railway:**
   - Go to your service → Variables
   - Add: `APIFY_API_KEY` = (paste your token)

---

## Quick Commands to Check Locally:

```bash
# Check if keys are in .env file
cat .env | grep YOUTUBE_API_KEY
cat .env | grep APIFY_API_KEY

# Or view entire .env (be careful - contains secrets!)
cat .env
```

---

## If You Lost Your Keys:

### YouTube:
- Go to: https://console.cloud.google.com/apis/credentials
- You can see all your API keys
- Or create a new one

### Apify:
- Go to: https://console.apify.com/account/integrations
- You can see/regenerate your API tokens

---

## Security Note:

⚠️ **Never share your API keys publicly!**
- Don't commit them to git
- Don't share them in chat
- Keep them in `.env` or Railway variables only

