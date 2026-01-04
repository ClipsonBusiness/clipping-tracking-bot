# 🔧 Railway Deployment Fix

## Common Issues & Solutions

### Issue: "Application failed to respond"

**Check these in Railway:**

1. **Port Configuration**
   - Railway sets `PORT` automatically
   - Your app should use `process.env.PORT`
   - ✅ Already configured in `src/server.ts`

2. **Check Deployment Logs**
   - Go to Railway dashboard
   - Click your service → "Deployments"
   - Click latest deployment → "View Logs"
   - Look for errors

3. **Environment Variables**
   Make sure these are set:
   ```
   DATABASE_URL=<from PostgreSQL service>
   REDIS_URL=<from Redis service>
   YOUTUBE_API_KEY=<your key>
   APIFY_API_KEY=<your key>
   SOCIAVAULT_API_KEY=<your key>
   NODE_ENV=production
   PORT=<auto-set by Railway>
   ```

4. **Database Connection**
   - Make sure PostgreSQL service is running
   - Check `DATABASE_URL` is correct
   - Migrations should run automatically on start

5. **Build Success but Runtime Error**
   - Check if TypeScript compiled successfully
   - Check if Prisma Client generated
   - Check if migrations ran

## Quick Debug Steps

1. **View Logs:**
   ```
   Railway Dashboard → Service → Deployments → Latest → Logs
   ```

2. **Check Health Endpoint:**
   ```
   https://your-app.up.railway.app/health
   ```

3. **Common Errors:**
   - `DATABASE_URL not set` → Add PostgreSQL service
   - `Port already in use` → Railway handles this automatically
   - `Prisma Client not generated` → Check build logs
   - `Migration failed` → Check DATABASE_URL

## If Still Not Working

1. **Redeploy:**
   - Service → Settings → Redeploy

2. **Check Service Status:**
   - Make sure service is "Active"
   - Check if it's using correct Dockerfile

3. **Test Locally First:**
   ```bash
   docker build -t test-app .
   docker run -p 3001:3001 -e DATABASE_URL="your-db-url" test-app
   ```

