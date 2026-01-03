# API Reference

## Base URL
- Development: `http://localhost:3000`
- Health Check: `http://localhost:3000/health`

## Authentication
All API routes (except `/health`) require authentication headers:
- `x-user-id`: User ID
- `x-user-role`: `CLIPPER` or `ADMIN`

## Public Endpoints

### Health Check
```
GET /health
```
Returns server status.

---

## User Endpoints (CLIPPER role)

### Social Accounts

#### Create YouTube Social Account
```
POST /api/social-accounts/youtube
Headers: x-user-id, x-user-role: CLIPPER
Body: { "handle": "@channelname" }
```
Creates a pending social account and returns verification code.

#### Verify Social Account
```
POST /api/social-accounts/:id/verify
Headers: x-user-id, x-user-role: CLIPPER
```
Verifies the social account by checking for verification code in channel description.

### Submissions

#### Create YouTube Submission
```
POST /api/submissions/youtube
Headers: x-user-id, x-user-role: CLIPPER
Body: { "url": "https://www.youtube.com/watch?v=..." }
```
Creates a submission for a YouTube video. Requires verified social account matching video author.

---

## Admin Endpoints (ADMIN role)

### Submissions Management

#### List Submissions
```
GET /admin/submissions?page=1&pageSize=20&status=PENDING&platform=YOUTUBE&search=email
Headers: x-user-id, x-user-role: ADMIN
```
Returns paginated list of submissions with summary statistics.

Query Parameters:
- `page`: Page number (default: 1)
- `pageSize`: Items per page (default: 20, max: 100)
- `status`: Filter by status (PENDING, APPROVED, REJECTED, REMOVED)
- `platform`: Filter by platform (YOUTUBE)
- `search`: Search by creator email or handle

#### Get Submission Details
```
GET /admin/submissions/:id/details
Headers: x-user-id, x-user-role: ADMIN
```
Returns detailed submission information with snapshots and deltas.

#### Approve Submission
```
POST /admin/submissions/:id/approve
Headers: x-user-id, x-user-role: ADMIN
```
Approves a submission (idempotent).

#### Reject Submission
```
POST /admin/submissions/:id/reject
Headers: x-user-id, x-user-role: ADMIN
Body: { "reason": "Rejection reason" }
```
Rejects a submission with a reason.

---

## Background Jobs

### Metrics Pipeline
- Automatically runs every 10 minutes
- Fetches metrics for YouTube submissions
- Updates submission metrics and creates snapshots
- Refresh intervals based on submission age

---

## Example Requests

### Using cURL

```bash
# Health check
curl http://localhost:3000/health

# Create social account (requires auth headers)
curl -X POST http://localhost:3000/api/social-accounts/youtube \
  -H "x-user-id: user123" \
  -H "x-user-role: CLIPPER" \
  -H "Content-Type: application/json" \
  -d '{"handle": "@myyoutubechannel"}'

# Create submission
curl -X POST http://localhost:3000/api/submissions/youtube \
  -H "x-user-id: user123" \
  -H "x-user-role: CLIPPER" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=VIDEO_ID"}'

# List submissions (admin)
curl "http://localhost:3000/admin/submissions?page=1&pageSize=20" \
  -H "x-user-id: admin123" \
  -H "x-user-role: ADMIN"
```

---

## Environment Variables Required

```env
DATABASE_URL="postgresql://user:password@localhost:5432/clipping_tracking"
REDIS_URL="redis://localhost:6379"
YOUTUBE_API_KEY="your_youtube_api_key"
BASE_URL="http://localhost:3000"
PORT=3000
NODE_ENV=development
```

