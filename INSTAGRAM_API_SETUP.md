# Instagram API Setup Guide

This guide will help you set up Instagram API access for the Clipping Tracking Bot.

## Overview

Instagram provides API access through **Meta for Developers** (formerly Facebook Developers). You'll need to:
1. Create a Meta Developer account
2. Create a Facebook App
3. Add Instagram Basic Display or Instagram Graph API
4. Get an access token
5. Configure it in your `.env` file

## Step 1: Create a Meta Developer Account

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Click **"Get Started"** or **"Log In"** if you already have an account
3. Use your Facebook account to sign in (or create one if needed)
4. Complete the developer account setup

## Step 2: Create a Facebook App

1. Once logged in, go to **"My Apps"** → **"Create App"**
2. Select **"Business"** as the app type (or "Consumer" for personal use)
3. Fill in the app details:
   - **App Name**: e.g., "Clipping Tracking Bot"
   - **App Contact Email**: Your email
   - **Business Account**: Select or create one
4. Click **"Create App"**

## Step 3: Add Instagram Product

1. In your app dashboard, go to **"Add Products"**
2. Find **"Instagram"** and click **"Set Up"**
3. Choose the API you need:
   - **Instagram Basic Display API**: For personal accounts (simpler, limited)
   - **Instagram Graph API**: For business/creator accounts (more features, recommended)

### For Instagram Graph API (Recommended):

1. Go to **"Instagram Graph API"** → **"Get Started"**
2. You'll need:
   - A Facebook Page connected to an Instagram Business/Creator account
   - Or an Instagram account you can convert to Business/Creator

## Step 4: Configure App Settings

1. Go to **"Settings"** → **"Basic"**
2. Add required information:
   - **App Domains**: Your website domain
   - **Privacy Policy URL**: Required
   - **Terms of Service URL**: Optional
   - **User Data Deletion**: URL for data deletion callback
3. Add **"Instagram"** to **"App Review"** → **"Permissions and Features"**

## Step 5: Get Your Access Token

### For Instagram Graph API:

1. Go to **"Tools"** → **"Graph API Explorer"**
2. Select your app from the dropdown
3. Select the Instagram account/page you want to use
4. Add required permissions:
   - `instagram_basic`
   - `instagram_content_publish` (if needed)
   - `pages_read_engagement` (if needed)
5. Click **"Generate Access Token"**
6. Copy the token (it's a long-lived token, but may expire)

### For Instagram Basic Display API:

1. Go to **"Tools"** → **"Basic Display"**
2. Create a test user or use your own account
3. Generate a token with these permissions:
   - `user_profile`
   - `user_media`

## Step 6: Add to Your .env File

1. Open your `.env` file in the project root
2. Add the following line:

```env
INSTAGRAM_ACCESS_TOKEN=your_access_token_here
```

Replace `your_access_token_here` with your actual token.

**Example:**
```env
INSTAGRAM_ACCESS_TOKEN=IGQWRNabc123xyz789...
```

## Step 7: Restart Your Server

After adding the token, restart your development server:

```bash
# Stop the server (Ctrl+C)
# Then restart
npm run dev
```

## Important Notes

### Rate Limits
- Instagram Graph API: 200 requests per hour per user
- Instagram Basic Display: 200 requests per hour
- The bot includes retry logic, but be mindful of limits

### Token Expiration
- Short-lived tokens expire in 1 hour
- Long-lived tokens expire in 60 days
- For production, implement token refresh logic
- Use the **Token Exchange** endpoint to get long-lived tokens

### API Endpoints Used
The bot uses these Instagram API endpoints:
- `GET /{user-id}` - Get user profile and bio
- `GET /{media-id}` - Get media metrics (likes, comments, views)

### Testing
1. Create an Instagram social account in the UI
2. Add the verification code to your Instagram bio
3. Try verifying the account
4. If successful, you should see "Account verified successfully"

## Troubleshooting

### "INSTAGRAM_ACCESS_TOKEN is required"
- Make sure you've added the token to your `.env` file
- Check for typos in the variable name
- Restart the server after adding the token

### "API integration not yet implemented"
- The collector structure is ready, but actual API calls need to be implemented
- Check `src/collectors/instagramCollector.ts` for TODO comments
- Implement the API calls following the examples in the comments

### "Invalid token" or "OAuthException"
- Verify your token is correct
- Check if the token has expired
- Ensure you've requested the correct permissions
- Make sure your app is in the correct mode (Development/Production)

### "User not found" or "Media not found"
- Verify the Instagram account exists
- Check if the account is public or you have proper permissions
- For business accounts, ensure the account is connected to your app

### Rate Limit Errors
- Wait before retrying (200 requests/hour)
- Consider implementing request queuing
- Use batch requests when possible

## App Review (For Production)

If you plan to use this in production:
1. Complete **"App Review"** process
2. Submit required permissions for review
3. Provide use case and demo video
4. Wait for approval (can take several days)

## Next Steps

1. ✅ Add token to `.env`
2. ✅ Restart server
3. ⚠️ Implement API calls in `instagramCollector.ts` (currently placeholder)
4. ✅ Test account creation
5. ✅ Test account verification

## Resources

- [Meta for Developers](https://developers.facebook.com/)
- [Instagram Graph API Documentation](https://developers.facebook.com/docs/instagram-api)
- [Instagram Basic Display API](https://developers.facebook.com/docs/instagram-basic-display-api)
- [Graph API Explorer](https://developers.facebook.com/tools/explorer/)

## Support

If you encounter issues:
1. Check the Meta Developer documentation
2. Review error messages in the server logs
3. Verify your app permissions and scopes
4. Ensure your token hasn't expired
5. Check Instagram API status page

