# Quick YouTube API Key Setup

## Fast Steps:

1. **Go here:** https://console.cloud.google.com/apis/library/youtube.googleapis.com
2. **Click "Enable"** (if not already enabled)
3. **Go here:** https://console.cloud.google.com/apis/credentials
4. **Click "Create Credentials" → "API Key"**
5. **Copy the key**
6. **Add to `.env` file:**
   ```
   YOUTUBE_API_KEY="paste_your_key_here"
   ```
7. **Restart server** (or it will auto-reload)

That's it! 🎉

## Your Current .env File Location:
`/Users/tomastomasson/Clipping tracking bot/.env`

## What the API Key Does:
- Fetches video metrics (views, likes, comments)
- Resolves channel information
- Verifies channel descriptions (for account verification)
- Gets video author information

## Free Limits:
- 10,000 API calls per day (free)
- Enough for ~5,000 videos with 2 snapshots/day each

