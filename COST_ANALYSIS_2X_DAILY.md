# Cost Analysis: 2 Snapshots Per Day

## Snapshot Frequency Change

**Previous Schedule:**
- < 24h: every 60 minutes (24/day)
- 1-7 days: every 4 hours (6/day)
- 7-30 days: daily (1/day)
- 30+ days: weekly (0.14/day)

**New Schedule:**
- **All videos: 2 snapshots per day (every 12 hours)**

## Storage Calculations

### Per Video Per Year
- **2 snapshots/day × 365 days = 730 snapshots/year**
- Each snapshot: ~200 bytes
- **Per video: 730 × 200 bytes = 146 KB/year**

### Scale Estimates

| Videos Tracked | Snapshots/Year | Database Size | Monthly Growth |
|---------------|----------------|---------------|----------------|
| 1,000         | 730,000        | 146 MB        | ~12 MB/month   |
| 10,000        | 7.3M           | 1.46 GB       | ~122 MB/month  |
| 100,000       | 73M            | 14.6 GB       | ~1.22 GB/month |
| 1,000,000     | 730M           | 146 GB        | ~12.2 GB/month |

## Cost Comparison

### Previous Schedule (Variable Frequency)
- 1,000 videos: ~131,000 snapshots/year = **26 MB**
- 10,000 videos: ~1.31M snapshots/year = **260 MB**

### New Schedule (2x Daily)
- 1,000 videos: 730,000 snapshots/year = **146 MB** (5.6x more)
- 10,000 videos: 7.3M snapshots/year = **1.46 GB** (5.6x more)

## Monthly Cost Estimates

### Small Scale (1,000 videos)
- **Database**: 146 MB total, ~12 MB/month growth
- **Cost**: $0-5/month (free tier covers it)
- **Provider**: Supabase/Neon free tier (500 MB - 3 GB)

### Medium Scale (10,000 videos)
- **Database**: 1.46 GB total, ~122 MB/month growth
- **Cost**: $5-15/month
- **Provider**: Supabase ($25/mo for 8 GB) or Neon ($19/mo for 10 GB)

### Large Scale (100,000 videos)
- **Database**: 14.6 GB total, ~1.22 GB/month growth
- **Cost**: $25-50/month
- **Provider**: Supabase Pro ($25/mo) or Neon Pro ($19/mo) + storage

### Very Large Scale (1,000,000 videos)
- **Database**: 146 GB total, ~12.2 GB/month growth
- **Cost**: $100-200/month
- **Provider**: Dedicated database instance required

## YouTube API Impact

### API Quota Usage
- **2 fetches per video per day**
- 1,000 videos = 2,000 API calls/day (well under 10,000 free limit)
- 10,000 videos = 20,000 API calls/day (need 2 API keys or upgrade)
- 100,000 videos = 200,000 API calls/day (need 20 API keys or paid quota)

**YouTube API Limits:**
- Free tier: 10,000 units/day
- Each metrics fetch = 1 unit
- **Max free videos: ~5,000 videos** (2 fetches/day each)

## Cost Optimization Strategies

### 1. Limit Snapshot Retention
- Keep last 200 snapshots per video (as currently implemented)
- Archive older snapshots to cold storage (S3: $0.023/GB/month)
- After 200 snapshots, oldest gets deleted when new one added

### 2. Database Partitioning
- Partition by month for easier archiving
- Move old partitions to cheaper storage

### 3. Aggregation
- After 90 days: keep only daily snapshots (aggregate 2x daily into 1x daily)
- After 1 year: keep only weekly snapshots

### 4. Use Compression
- PostgreSQL TOAST compression for older snapshots
- Can reduce storage by 50-70%

## Recommended Approach

### For High Volume (10,000+ videos):
1. **Keep 2x daily for first 30 days** (most important growth period)
2. **Switch to daily after 30 days** (still good tracking, 50% less storage)
3. **Archive snapshots older than 1 year** to S3

This gives you:
- Detailed tracking during critical first month
- Long-term trends with lower storage costs
- **Estimated savings: 40-50% storage reduction**

## Real-World Example

**Scenario: 50,000 active videos**

**2x Daily (Current Plan):**
- 100,000 snapshots/day
- 36.5M snapshots/year
- ~7.3 GB/year
- **Cost: ~$50-75/month**

**Hybrid Approach (Recommended):**
- First 30 days: 2x daily
- After 30 days: 1x daily
- Archive after 1 year
- ~18M snapshots/year
- ~3.6 GB/year
- **Cost: ~$25-40/month** (40% savings)

## Conclusion

**2x daily snapshots is very affordable:**
- ✅ Small scale (1,000 videos): Free tier covers it
- ✅ Medium scale (10,000 videos): $5-15/month
- ✅ Large scale (100,000 videos): $25-50/month

**Main constraint:** YouTube API quota (10,000 free/day = ~5,000 videos max)

**Recommendation:** Start with 2x daily, implement snapshot limits (200 per video), and consider hybrid approach for very large scale.

