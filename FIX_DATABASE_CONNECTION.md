# 🔧 Fix Database Connection Error

## The Problem:
`postgres.railway.internal` only works inside Railway's network. From your local machine, you need the **public** connection string.

## Solution: Get Public DATABASE_URL

### Option 1: Get from Railway Dashboard (Easiest)

1. **Go to Railway:**
   - Click your **PostgreSQL service** (not the web service)
   - Go to **"Variables"** tab
   - Look for `DATABASE_URL` or `POSTGRES_URL`
   - **Copy the PUBLIC connection string** (should have a public hostname, not `railway.internal`)

2. **Or check your service variables:**
   - Go to your **web service** → **Variables** tab
   - Look at `DATABASE_URL`
   - If it says `railway.internal`, you need the public one

### Option 2: Use Railway CLI to Get It

```bash
npx @railway/cli variables
```

This will show all variables. Look for `DATABASE_URL` with a public hostname.

### Option 3: Run Command Inside Railway (Best)

Instead of running locally, run it **inside Railway's environment**:

```bash
npx @railway/cli run npx prisma db push
```

But make sure you're **linked** to the right service first:

```bash
npx @railway/cli link
# Select: bountiful-healing
# Select: clipping-tracking-api (your web service, not PostgreSQL)
```

Then Railway CLI will use the internal connection automatically!

---

## Quick Fix: Make Sure You're Linked Correctly

1. **Link to your WEB SERVICE (not PostgreSQL):**
   ```bash
   npx @railway/cli link
   ```
   - Select: **bountiful-healing**
   - Select: **clipping-tracking-api** (the web service)

2. **Then run:**
   ```bash
   npx @railway/cli run npx prisma db push
   ```

When you run via `railway run`, it uses Railway's internal network, so `railway.internal` will work!

---

## Why This Happens:

- `railway.internal` = Only works inside Railway's network
- Public hostname = Works from anywhere
- When you run `railway run`, it executes inside Railway, so internal hostnames work

---

## Next Steps:

1. ✅ Make sure you're linked to the **web service** (clipping-tracking-api)
2. ✅ Run: `npx @railway/cli run npx prisma db push`
3. ✅ Should work now!

