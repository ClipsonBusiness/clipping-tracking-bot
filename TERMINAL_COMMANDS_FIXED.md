# 🖥️ Run These Commands in Your Terminal (FIXED)

## Open Your Terminal

1. **Open Terminal app** (on Mac: Cmd+Space, type "Terminal")
2. **Navigate to your project:**
   ```bash
   cd "/Users/tomastomasson/Clipping tracking bot"
   ```

## Step-by-Step Commands:

### Step 1: Login to Railway (Browserless)
```bash
npx @railway/cli login --browserless
```
- This will give you a URL or token
- Copy the URL and open it in your browser
- Or follow the instructions it shows

### Step 2: Link to Your Project
```bash
npx @railway/cli link
```
- It will show you a list of projects
- Select: **bountiful-healing**
- Then select: **clipping-tracking-api**

### Step 3: Create Database Tables
```bash
npx @railway/cli run npx prisma db push
```
- This will connect to your database
- Create all the tables
- Show you the results

---

## What You Should See:

After Step 3, you should see:
```
✔ Generated Prisma Client
✔ Database schema synced successfully
```

Then your app should work!

---

## Quick Copy-Paste (All at Once):

```bash
cd "/Users/tomastomasson/Clipping tracking bot"
npx @railway/cli login --browserless
npx @railway/cli link
npx @railway/cli run npx prisma db push
```

**Run these one at a time in your terminal!**

