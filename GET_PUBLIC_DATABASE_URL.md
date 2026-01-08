# 🔧 Get Public DATABASE_URL

## The Problem:
`railway.internal` hostname doesn't work from Railway CLI. We need the **public** connection string.

## Solution: Get Public DATABASE_URL from Railway

### Step 1: Go to Railway Dashboard

1. Go to: https://railway.app/dashboard
2. Click your **PostgreSQL service** (not the web service)
3. Go to **"Variables"** tab

### Step 2: Find Public Connection String

Look for:
- `DATABASE_URL` - might be internal
- `POSTGRES_URL` - might be public
- Or click **"Connect"** tab - shows connection strings

### Step 3: Use Public Connection String

The public connection string should look like:
```
postgresql://postgres:password@containers-us-west-xxx.railway.app:5432/railway
```

**NOT:**
```
postgresql://postgres:password@postgres.railway.internal:5432/railway
```

### Step 4: Set It Locally (Temporarily)

In your terminal, run:

```bash
export DATABASE_URL="postgresql://postgres:password@containers-us-west-xxx.railway.app:5432/railway"
```

(Replace with your actual public connection string)

### Step 5: Run db push

```bash
npx prisma db push
```

This will use the public connection string and should work!

---

## Alternative: Check Railway Dashboard

1. Go to: PostgreSQL service → **"Connect"** tab
2. Look for **"Public Network"** connection string
3. Copy that
4. Use it as DATABASE_URL

---

## Quick Fix:

1. Get public DATABASE_URL from Railway dashboard
2. Set it: `export DATABASE_URL="your-public-connection-string"`
3. Run: `npx prisma db push`


