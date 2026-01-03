# How to Get a YouTube API Key

## Step 1: Go to Google Cloud Console

1. Visit: https://console.cloud.google.com/
2. Sign in with your Google account (the same one you use for YouTube)

## Step 2: Create a New Project (or select existing)

1. Click the project dropdown at the top
2. Click "New Project"
3. Name it something like "Clipping Tracking Bot"
4. Click "Create"

## Step 3: Enable YouTube Data API v3

1. Go to: https://console.cloud.google.com/apis/library
2. Search for "YouTube Data API v3"
3. Click on it
4. Click "Enable"

## Step 4: Create API Credentials

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click "Create Credentials" → "API Key"
3. Copy the API key that appears
4. (Optional but recommended) Click "Restrict Key":
   - Under "API restrictions", select "Restrict key"
   - Choose "YouTube Data API v3"
   - Click "Save"

## Step 5: Add to Your .env File

1. Open your `.env` file in the project root
2. Add or update this line:
   ```
   YOUTUBE_API_KEY="YOUR_API_KEY_HERE"
   ```
3. Replace `YOUR_API_KEY_HERE` with the actual key you copied

## Step 6: Restart Your Server

The server should auto-reload, but if not:
```bash
# Stop the server (Ctrl+C) and restart
npm run dev
```

## Free Quota Limits

- **10,000 units per day** (free)
- Each API call = 1 unit
- With 2 snapshots per day per video, you can track ~5,000 videos for free

## Testing

Once you've added the key, try the verification again:
1. Go to http://localhost:3001
2. Create a social account
3. Add the verification code to your YouTube channel description
4. Click "Check Account" - it should work now!

## Troubleshooting

**"API key not valid" error:**
- Make sure you copied the entire key (no spaces)
- Make sure YouTube Data API v3 is enabled
- Wait a few minutes after creating the key (sometimes takes time to activate)

**"Quota exceeded" error:**
- You've hit the 10,000/day limit
- Wait until the next day, or create additional API keys

