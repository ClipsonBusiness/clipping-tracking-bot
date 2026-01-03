# Instagram Graph API Setup Guide

## Overview
Instagram Graph API is Meta's official API for accessing Instagram data. It's more reliable than scraping but requires more setup.

## Important Links

### Main Documentation
- **Instagram Graph API Docs**: https://developers.facebook.com/docs/instagram-api
- **Getting Started Guide**: https://developers.facebook.com/docs/instagram-api/getting-started
- **API Reference**: https://developers.facebook.com/docs/instagram-api/reference

### Setup Resources
- **Meta for Developers**: https://developers.facebook.com/
- **Graph API Explorer**: https://developers.facebook.com/tools/explorer/
- **App Dashboard**: https://developers.facebook.com/apps/

## Requirements

### 1. Facebook Business Account
- You need a Facebook Business account (not personal)
- Create at: https://business.facebook.com/

### 2. Instagram Business/Creator Account
- Your Instagram account must be a **Business** or **Creator** account
- Convert at: Instagram App → Settings → Account Type → Switch to Professional Account

### 3. Facebook Page
- Your Instagram account must be connected to a Facebook Page
- Connect at: Instagram App → Settings → Account → Linked Accounts → Facebook

### 4. Facebook App
- Create a Facebook App at: https://developers.facebook.com/apps/
- Add "Instagram Graph API" product to your app

## Setup Steps

### Step 1: Create Facebook App
1. Go to https://developers.facebook.com/apps/
2. Click "Create App"
3. Choose "Business" type
4. Fill in app details
5. Add "Instagram Graph API" product

### Step 2: Get Access Token
1. Go to Graph API Explorer: https://developers.facebook.com/tools/explorer/
2. Select your app
3. Add permissions: `instagram_basic`, `pages_read_engagement`, `pages_show_list`
4. Generate access token (User Token)
5. Exchange for Long-Lived Token (valid 60 days)

### Step 3: Get Instagram Business Account ID
1. Use Graph API Explorer
2. Query: `GET /me/accounts` (gets your Facebook Pages)
3. Query: `GET /{page-id}?fields=instagram_business_account` (gets Instagram Account ID)

### Step 4: Add to .env
```env
INSTAGRAM_ACCESS_TOKEN=your_long_lived_token_here
INSTAGRAM_BUSINESS_ACCOUNT_ID=your_instagram_account_id_here
```

## API Endpoints for Post Metrics

### Get Post Metrics
```
GET /{ig-media-id}?fields=id,like_count,comments_count,media_type,timestamp
```

### Get Post Insights (requires Business Account)
```
GET /{ig-media-id}/insights?metric=impressions,reach,engagement
```

## Limitations

⚠️ **Important Limitations:**
- Only works for **your own** Instagram posts (posts from accounts you manage)
- Cannot fetch metrics for other users' posts
- Requires app review for production use
- Access tokens expire (need refresh mechanism)

## For Your Use Case

**Problem:** Instagram Graph API only works for posts from accounts you own/manage. It **cannot** fetch metrics for arbitrary public posts from other users.

**This means:** If users are submitting their own Instagram posts, Graph API works. But if they're submitting posts from other accounts, it won't work.

## Alternative: Instagram Basic Display API

For public posts from any account, you might need:
- **Instagram Basic Display API**: https://developers.facebook.com/docs/instagram-basic-display-api
- But this also has limitations and requires user authentication

## Recommendation

Since you need to track metrics for **any public Instagram post** (not just your own), Instagram Graph API might not be suitable. However, if all submissions are from verified accounts that users own, it could work.

**Would you like me to:**
1. Implement Instagram Graph API integration (for user's own posts)?
2. Keep trying to make Apify work?
3. Look for another API that works with any public post?

