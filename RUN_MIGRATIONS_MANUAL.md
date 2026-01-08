# 🔧 Run Database Migrations Manually

## The Problem:
Tables don't exist because migrations haven't run. The migration SQL might need to be fixed for PostgreSQL.

## Quick Fix: Run Migrations via Railway CLI

### Option 1: Use Railway CLI (Easiest)

1. **Install Railway CLI:**
   ```bash
   npm i -g @railway/cli
   ```

2. **Login:**
   ```bash
   railway login
   ```

3. **Link to your project:**
   ```bash
   railway link
   ```
   - Select your project: "bountiful-healing"

4. **Run migrations:**
   ```bash
   railway run npx prisma migrate deploy
   ```

---

### Option 2: Run via Railway Dashboard

1. **Go to your service** → **"Deployments"** tab
2. **Click on latest deployment** → **"View Logs"**
3. **Check if migrations ran:**
   - Look for: "Running database migrations..."
   - Look for: "Migrations completed successfully!"
   - If you see errors, migrations failed

---

### Option 3: Fix Migration SQL for PostgreSQL

The migration SQL uses SQLite syntax. We need to regenerate it for PostgreSQL:

1. **Delete old migrations:**
   ```bash
   rm -rf prisma/migrations
   ```

2. **Create new migration for PostgreSQL:**
   ```bash
   npx prisma migrate dev --name init_postgresql
   ```

3. **But wait!** This will create a new migration. Instead, let's fix the existing one.

---

### Option 4: Fix Existing Migration SQL

The migration uses `DATETIME` which is SQLite. PostgreSQL uses `TIMESTAMP`.

Let me create a script to fix this:


