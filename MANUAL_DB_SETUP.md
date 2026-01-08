# 🚨 Manual Database Setup - URGENT FIX

## The Problem:
Tables still don't exist. Migrations aren't running automatically.

## Quick Fix: Run Database Setup Manually

### Step 1: Install Railway CLI

```bash
npm i -g @railway/cli
```

### Step 2: Login to Railway

```bash
railway login
```
- This will open your browser
- Authorize Railway CLI

### Step 3: Link to Your Project

```bash
railway link
```
- Select your project: "bountiful-healing"
- Select your service: "clipping-tracking-api"

### Step 4: Run Database Setup

```bash
railway run npx prisma db push
```

This will:
- ✅ Connect to your database
- ✅ Create all tables
- ✅ Sync your schema

### Step 5: Verify

After running, test your app:
```
https://your-app.up.railway.app/health
```

---

## Alternative: Check if DATABASE_URL is Set

The issue might be that DATABASE_URL isn't accessible to the service.

1. **Go to Railway:**
   - Service → Variables tab
   - Check if `DATABASE_URL` is there

2. **If not there:**
   - Add it from Shared Variables
   - Or copy from PostgreSQL service

3. **Verify the value:**
   - Should start with: `postgresql://...`
   - Should not be empty

---

## Quick Test: Check Database Connection

Run this to test if DATABASE_URL works:

```bash
railway run npx prisma db pull
```

If this works, the connection is good. Then run:

```bash
railway run npx prisma db push
```

---

## If Railway CLI Doesn't Work

### Option 1: Use Railway Dashboard

1. Go to your service → Settings
2. Look for "Run Command" or "Shell" option
3. Run: `npx prisma db push`

### Option 2: Check Logs

1. Go to: Service → Deployments → Latest → View Logs
2. Look for database errors
3. Check if DATABASE_URL is being read

---

## Most Likely Issue:

**DATABASE_URL is not set in your service variables!**

Even though it's in Shared Variables, your service needs it directly.

**Fix:**
1. Go to: Service → Variables
2. Add: `DATABASE_URL` = (copy from Shared Variables or PostgreSQL service)
3. Redeploy

---

## Step-by-Step Checklist:

- [ ] Install Railway CLI: `npm i -g @railway/cli`
- [ ] Login: `railway login`
- [ ] Link project: `railway link`
- [ ] Run db push: `railway run npx prisma db push`
- [ ] Check service variables for DATABASE_URL
- [ ] Test health endpoint
- [ ] Verify tables exist


