# Quick API Setup Guide

Quick reference for setting up all three platforms.

## YouTube API ✅ (Currently Working)

**Status**: Fully implemented and working

1. Get API key from [Google Cloud Console](https://console.cloud.google.com/)
2. Enable YouTube Data API v3
3. Add to `.env`:
   ```env
   YOUTUBE_API_KEY=your_api_key_here
   ```
4. Restart server - **Ready to use!**

See `YOUTUBE_API_SETUP.md` for detailed instructions.

---

## TikTok API ⚠️ (Needs Implementation)

**Status**: Routes ready, API calls need implementation

1. Create app at [TikTok for Developers](https://developers.tiktok.com/)
2. Get access token
3. Add to `.env`:
   ```env
   TIKTOK_ACCESS_TOKEN=your_token_here
   ```
4. **Implement API calls** in `src/collectors/tiktokCollector.ts`
5. Restart server

See `TIKTOK_API_SETUP.md` for detailed instructions.

---

## Instagram API ⚠️ (Needs Implementation)

**Status**: Routes ready, API calls need implementation

1. Create app at [Meta for Developers](https://developers.facebook.com/)
2. Add Instagram product (Graph API recommended)
3. Get access token
4. Add to `.env`:
   ```env
   INSTAGRAM_ACCESS_TOKEN=your_token_here
   ```
5. **Implement API calls** in `src/collectors/instagramCollector.ts`
6. Restart server

See `INSTAGRAM_API_SETUP.md` for detailed instructions.

---

## Current .env File Structure

```env
# Database
DATABASE_URL="file:./dev.db"

# Redis (for background jobs)
REDIS_URL="redis://localhost:6379"

# YouTube API (✅ Working)
YOUTUBE_API_KEY=your_youtube_api_key

# TikTok API (⚠️ Needs implementation)
TIKTOK_ACCESS_TOKEN=your_tiktok_token

# Instagram API (⚠️ Needs implementation)
INSTAGRAM_ACCESS_TOKEN=your_instagram_token

# Server
PORT=3001
BASE_URL=http://localhost:3001
```

---

## Implementation Status

| Platform | Routes | API Integration | Status |
|----------|--------|----------------|--------|
| YouTube  | ✅     | ✅             | **Working** |
| TikTok   | ✅     | ⚠️             | Needs API implementation |
| Instagram| ✅     | ⚠️             | Needs API implementation |

---

## Next Steps

1. **For YouTube**: Already working! Just add your API key.
2. **For TikTok/Instagram**: 
   - Get API credentials (see detailed guides)
   - Add tokens to `.env`
   - Implement API calls in collectors
   - Test and verify

---

## Need Help?

- **YouTube**: See `YOUTUBE_API_SETUP.md`
- **TikTok**: See `TIKTOK_API_SETUP.md`
- **Instagram**: See `INSTAGRAM_API_SETUP.md`

