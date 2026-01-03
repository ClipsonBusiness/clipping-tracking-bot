# Quick Start Guide

## Option 1: Use SQLite for Local Testing (Easiest)

For quick local testing without setting up PostgreSQL:

1. **Update Prisma schema** to use SQLite:
   ```prisma
   datasource db {
     provider = "sqlite"
     url      = "file:./dev.db"
   }
   ```

2. **Create .env file**:
   ```env
   DATABASE_URL="file:./dev.db"
   REDIS_URL="redis://localhost:6379"
   YOUTUBE_API_KEY="your_key_here"
   ```

3. **Run migrations**:
   ```bash
   npm run prisma:migrate
   ```

4. **Restart server** - it should work now!

## Option 2: Use Free Cloud Database (Recommended for Production)

### Supabase (Easiest)
1. Go to https://supabase.com
2. Create free account
3. Create new project
4. Copy the connection string
5. Add to `.env`:
   ```env
   DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres"
   ```
6. Run migrations: `npm run prisma:migrate`

### Neon (Also Free)
1. Go to https://neon.tech
2. Create free account
3. Create database
4. Copy connection string
5. Add to `.env`
6. Run migrations

## Option 3: Local PostgreSQL

1. **Install PostgreSQL** (if not installed):
   ```bash
   # macOS
   brew install postgresql
   brew services start postgresql
   
   # Create database
   createdb clipping_tracking
   ```

2. **Create .env file**:
   ```env
   DATABASE_URL="postgresql://localhost:5432/clipping_tracking"
   REDIS_URL="redis://localhost:6379"
   YOUTUBE_API_KEY="your_key_here"
   ```

3. **Run migrations**:
   ```bash
   npm run prisma:migrate
   ```

## Redis (Optional for Background Jobs)

Redis is only needed for background metrics jobs. For basic API testing, you can skip it.

If you want Redis:
```bash
# macOS
brew install redis
brew services start redis
```

Or use Upstash (free serverless Redis):
1. Go to https://upstash.com
2. Create free database
3. Copy connection URL
4. Add to `.env`: `REDIS_URL="your_upstash_url"`

## Testing

Once database is set up:
1. Restart server: `npm run dev`
2. Try the API endpoint again
3. Should work! ✅

