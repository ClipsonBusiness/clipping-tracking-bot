# Discord Bot Setup Guide

This guide will help you set up the Discord bot for the Clipping Tracking Bot.

## Prerequisites

1. A Discord application and bot token
2. Node.js 20+ installed
3. The application running with database access

## Step 1: Create a Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to the "Bot" section
4. Click "Add Bot"
5. Under "Token", click "Reset Token" and copy the token (you'll need this)
6. Enable the following Privileged Gateway Intents:
   - ✅ Server Members Intent (if needed)
   - ✅ Message Content Intent (required for commands)

## Step 2: Get Your Client ID and Guild ID

1. In the Discord Developer Portal, go to "General Information"
2. Copy the "Application ID" (this is your `DISCORD_CLIENT_ID`)
3. (Optional) To get your Guild ID:
   - Enable Developer Mode in Discord (Settings > Advanced > Developer Mode)
   - Right-click your server and select "Copy Server ID"

## Step 3: Invite Bot to Your Server

1. In the Discord Developer Portal, go to "OAuth2" > "URL Generator"
2. Select the following scopes:
   - `bot`
   - `applications.commands`
3. Select the following bot permissions:
   - Send Messages
   - Use Slash Commands
   - Embed Links
   - Read Message History
4. Copy the generated URL and open it in your browser
5. Select your server and authorize the bot

## Step 4: Set Environment Variables

Add the following to your `.env` file:

```env
# Discord Bot Configuration
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_GUILD_ID=your_guild_id_here  # Optional: for faster command registration (guild-specific)
BASE_URL=http://localhost:3001  # Your API base URL (use production URL in production)
```

For production (Railway/Heroku/etc.), set these as environment variables in your hosting platform.

## Step 5: Run Database Migration

The bot requires a `discordId` field on the User model. Run:

```bash
npx prisma migrate dev --name add_discord_id
```

Or if you're using `db push`:

```bash
npx prisma db push
```

## Step 6: Install Dependencies and Start

```bash
npm install
npm run build
npm start
```

The bot will automatically:
- Register slash commands on startup
- Connect to Discord
- Handle all commands

## Available Commands

### Clipper Commands

- `/submit <url>` - Submit content for tracking (auto-detects platform)
- `/verify <platform> <handle>` - Verify a social media account (YouTube, TikTok, Instagram)
- `/check-verify <account_id>` - Check if account verification is complete
- `/accounts` - List your verified social accounts
- `/status` - View your submission status
- `/link <email> [password]` - Link your Discord account to your app account

### Admin Commands

- `/submissions [status] [page]` - View submissions with optional filtering
- `/approve <submission_id>` - Approve a submission
- `/reject <submission_id> [reason]` - Reject a submission with optional reason

## Usage Flow

1. **Link Your Account**: First, use `/link <email> [password]` to link your Discord account to your app account
2. **Verify Social Accounts**: Use `/verify` to add and verify your social media accounts
3. **Submit Content**: Use `/submit <url>` to submit content for tracking
4. **Check Status**: Use `/status` to see your submissions

## Troubleshooting

### Bot doesn't respond to commands

1. Check that `DISCORD_BOT_TOKEN` and `DISCORD_CLIENT_ID` are set correctly
2. Verify the bot is online in your Discord server
3. Check server logs for errors
4. Commands may take up to 1 hour to propagate globally (use `DISCORD_GUILD_ID` for instant guild commands)

### "You need to link your Discord account first"

1. Make sure you've created an account via the web interface or API
2. Use `/link <email> [password]` to link your Discord account
3. Verify your email and password are correct

### Commands not showing up

1. If using `DISCORD_GUILD_ID`, commands should appear immediately
2. Without `DISCORD_GUILD_ID`, global commands can take up to 1 hour
3. Try restarting the bot and waiting a few minutes
4. Check that the bot has the `applications.commands` scope

### API errors

1. Verify `BASE_URL` is set correctly (should point to your API server)
2. Check that the API server is running and accessible
3. Verify database connection is working

## Security Notes

- Never commit your `DISCORD_BOT_TOKEN` to version control
- Use environment variables for all sensitive configuration
- The bot uses the same authentication system as the web interface
- Admin commands check user roles before executing

## Production Deployment

When deploying to production:

1. Set `BASE_URL` to your production API URL (e.g., `https://your-api.railway.app`)
2. Ensure `DISCORD_BOT_TOKEN` and `DISCORD_CLIENT_ID` are set as environment variables
3. The bot will automatically connect when the server starts
4. Monitor logs for any connection issues

