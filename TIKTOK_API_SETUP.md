# TikTok API Setup Guide

This guide will help you set up TikTok API access for the Clipping Tracking Bot.

## Overview

TikTok provides API access through their **TikTok for Developers** platform. You'll need to:
1. Create a TikTok Developer account
2. Create an application
3. Get an access token
4. Configure it in your `.env` file

## Step 1: Create a TikTok Developer Account

1. Go to [TikTok for Developers](https://developers.tiktok.com/)
2. Click **"Sign Up"** or **"Log In"** if you already have an account
3. Use your TikTok account to sign in (or create one if needed)

## Step 2: Create an Application

1. Once logged in, go to the **"My Apps"** section
2. Click **"Create App"**
3. Fill in the application details:
   - **App Name**: e.g., "Clipping Tracking Bot"
   - **App Description**: Describe your use case
   - **Category**: Select appropriate category (e.g., "Business Tools")
   - **Website URL**: Your website URL (required)
   - **Privacy Policy URL**: Your privacy policy URL (required)
   - **Terms of Service URL**: Your terms of service URL (optional)
4. Accept the terms and conditions
5. Click **"Submit"**

## Step 3: Configure App Permissions

1. After creating the app, go to **"Products"** tab
2. Enable the following products (based on what you need):
   - **User Information API**: To get user profile and bio
   - **Video Information API**: To get video metrics (views, likes, comments, shares)
3. Review and accept the required permissions

## Step 4: Get Your Access Token

### Option A: Client Key (for testing/development)

1. Go to your app's **"Basic Information"** tab
2. You'll see:
   - **Client Key** (App ID)
   - **Client Secret**
3. For development, you can use the **Client Key** directly

### Option B: Access Token (for production)

1. Go to **"Tools"** → **"Generate Token"**
2. Select the scopes you need:
   - `user.info.basic` - Basic user information
   - `user.info.profile` - User profile information
   - `video.list` - Video information
   - `video.basic` - Basic video metrics
3. Click **"Generate Token"**
4. Copy the generated access token (it will only be shown once!)

## Step 5: Add to Your .env File

1. Open your `.env` file in the project root
2. Add the following line:

```env
TIKTOK_ACCESS_TOKEN=your_access_token_here
```

Replace `your_access_token_here` with your actual token.

**Example:**
```env
TIKTOK_ACCESS_TOKEN=clt.abc123xyz789...
```

## Step 6: Restart Your Server

After adding the token, restart your development server:

```bash
# Stop the server (Ctrl+C)
# Then restart
npm run dev
```

## Important Notes

### Rate Limits
- TikTok API has rate limits (varies by endpoint)
- Check your app dashboard for current limits
- The bot includes retry logic, but be mindful of limits

### Token Expiration
- Access tokens may expire
- For production, implement token refresh logic
- For development, you can regenerate tokens as needed

### API Endpoints Used
The bot uses these TikTok API endpoints:
- `GET /user/info/` - Get user profile and bio
- `GET /video/query/` - Get video metrics

### Testing
1. Create a TikTok social account in the UI
2. Add the verification code to your TikTok bio
3. Try verifying the account
4. If successful, you should see "Account verified successfully"

## Troubleshooting

### "TIKTOK_ACCESS_TOKEN is required"
- Make sure you've added the token to your `.env` file
- Check for typos in the variable name
- Restart the server after adding the token

### "API integration not yet implemented"
- The collector structure is ready, but actual API calls need to be implemented
- Check `src/collectors/tiktokCollector.ts` for TODO comments
- Implement the API calls following the examples in the comments

### "Invalid token" or "Unauthorized"
- Verify your token is correct
- Check if the token has expired
- Ensure you've enabled the required API products in your app

### Rate Limit Errors
- Wait before retrying
- Consider implementing request queuing
- Check your app's rate limit dashboard

## Next Steps

1. ✅ Add token to `.env`
2. ✅ Restart server
3. ⚠️ Implement API calls in `tiktokCollector.ts` (currently placeholder)
4. ✅ Test account creation
5. ✅ Test account verification

## Resources

- [TikTok for Developers Documentation](https://developers.tiktok.com/doc/)
- [TikTok API Reference](https://developers.tiktok.com/doc/)
- [TikTok Developer Portal](https://developers.tiktok.com/)

## Support

If you encounter issues:
1. Check the TikTok Developer documentation
2. Review error messages in the server logs
3. Verify your app permissions and scopes
4. Ensure your token hasn't expired

