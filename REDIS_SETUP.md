# Redis Setup Guide

## Problem
You're seeing `ECONNREFUSED` errors on port 6379. This means Redis is not running, but BullMQ (the background job queue) requires Redis to function.

## Quick Fix

### Option 1: Install and Start Redis (Recommended)

**On macOS (using Homebrew):**
```bash
# Install Redis
brew install redis

# Start Redis (runs in background)
brew services start redis

# Or start Redis manually (foreground)
redis-server
```

**On Linux:**
```bash
# Install Redis
sudo apt-get update
sudo apt-get install redis-server

# Start Redis
sudo systemctl start redis
sudo systemctl enable redis  # Auto-start on boot
```

**On Windows:**
- Download Redis from: https://github.com/microsoftarchive/redis/releases
- Or use WSL (Windows Subsystem for Linux) and follow Linux instructions

### Option 2: Use Docker (Alternative)

```bash
# Run Redis in Docker
docker run -d -p 6379:6379 --name redis redis:latest

# Check if it's running
docker ps
```

### Option 3: Use Cloud Redis (Production)

For production, use a managed Redis service:
- **Redis Cloud**: https://redis.com/try-free/
- **AWS ElastiCache**: https://aws.amazon.com/elasticache/
- **Upstash**: https://upstash.com/

Update your `.env` file:
```env
REDIS_URL=redis://your-redis-host:6379
```

## Verify Redis is Running

```bash
# Test Redis connection
redis-cli ping
# Should return: PONG

# Check if Redis is listening on port 6379
lsof -i :6379
# Or
netstat -an | grep 6379
```

## Update Your .env File

Make sure your `.env` file has:
```env
REDIS_URL=redis://localhost:6379
```

If Redis is running on a different host/port:
```env
REDIS_URL=redis://your-host:6379
```

## Restart Your Server

After starting Redis, restart your Node.js server:
```bash
# Stop the server (Ctrl+C)
# Then restart
npm run dev
```

## Troubleshooting

### Redis Still Not Connecting

1. **Check if Redis is actually running:**
   ```bash
   ps aux | grep redis
   ```

2. **Check Redis logs:**
   ```bash
   # If using Homebrew
   tail -f /usr/local/var/log/redis.log
   
   # Or check system logs
   journalctl -u redis
   ```

3. **Try connecting manually:**
   ```bash
   redis-cli
   # Then type: PING
   # Should return: PONG
   ```

4. **Check firewall/port:**
   ```bash
   # Make sure port 6379 is not blocked
   telnet localhost 6379
   ```

### Redis Connection Refused After Starting

- Make sure Redis is listening on the correct interface
- Check Redis config: `redis-cli CONFIG GET bind`
- Default should be `127.0.0.1` or `0.0.0.0`

## For Development (Optional: Skip Redis)

If you just want to test the API without background jobs, you can temporarily disable the metrics worker. However, this means:
- ❌ No automatic metric tracking
- ❌ No background job processing
- ✅ API endpoints will still work
- ✅ Submissions will be created, but metrics won't be automatically updated

To disable the worker, comment out the worker import in `src/server.ts`:
```typescript
// import { metricsWorker } from './jobs/metricsWorker';
// metricsWorker();
```

But it's better to just start Redis! 😊

