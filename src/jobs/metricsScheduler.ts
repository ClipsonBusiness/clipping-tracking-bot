import { PrismaClient } from '@prisma/client';
import { addMetricsJob } from './metricsQueue';

const prisma = new PrismaClient();

/**
 * Determine if a submission is due for metrics refresh
 * New schedule: 2 snapshots per day (every 12 hours) for all videos
 */
function isDueForRefresh(submission: { createdAt: Date; lastMetricsAt: Date | null }): boolean {
  const lastMetricsAt = submission.lastMetricsAt;
  if (!lastMetricsAt) {
    // Never fetched, always due
    return true;
  }

  const now = new Date();
  const timeSinceLastMetrics = now.getTime() - lastMetricsAt.getTime();
  const hoursSinceLastMetrics = timeSinceLastMetrics / (1000 * 60 * 60);

  // 2 snapshots per day = every 12 hours
  return hoursSinceLastMetrics >= 12;
}

/**
 * Schedule metrics jobs for due submissions
 */
export async function scheduleMetricsJobs(): Promise<{
  enqueued: number;
  skipped: number;
  errors: number;
}> {
  const startTime = Date.now();
  console.log('[Metrics Scheduler] Starting metrics job scheduling...');

  let enqueued = 0;
  let skipped = 0;
  let errors = 0;

  try {
    // Select due submissions for all platforms (YOUTUBE, TIKTOK, INSTAGRAM) with status in (PENDING, APPROVED)
    const submissions = await prisma.submission.findMany({
      where: {
        platform: {
          in: ['YOUTUBE', 'TIKTOK', 'INSTAGRAM'],
        },
        status: {
          in: ['PENDING', 'APPROVED'],
        },
      },
      select: {
        id: true,
        platform: true,
        createdAt: true,
        lastMetricsAt: true,
      },
    });

    console.log(`[Metrics Scheduler] Found ${submissions.length} submissions to check (all platforms)`);

    // Process each submission
    for (const submission of submissions) {
      try {
        if (isDueForRefresh(submission)) {
          // Enqueue job (dedup by jobId which is submissionId)
          await addMetricsJob(submission.id);
          enqueued++;
          console.log(`[Metrics Scheduler] Enqueued job for submission ${submission.id}`);
        } else {
          skipped++;
        }
      } catch (error) {
        errors++;
        console.error(`[Metrics Scheduler] Error enqueueing job for submission ${submission.id}:`, error);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Metrics Scheduler] Completed scheduling in ${duration}ms`);
    console.log(`[Metrics Scheduler] Stats: ${enqueued} enqueued, ${skipped} skipped, ${errors} errors`);

    return { enqueued, skipped, errors };
  } catch (error) {
    console.error('[Metrics Scheduler] Fatal error during scheduling:', error);
    throw error;
  }
}

/**
 * Start the metrics scheduler (runs every 10 minutes)
 * Checks for videos due for refresh (2x per day = every 12 hours)
 */
export function startMetricsScheduler(): NodeJS.Timeout {
  console.log('[Metrics Scheduler] Starting scheduler (runs every 10 minutes, 2x daily snapshots)');

  // Run immediately on start
  scheduleMetricsJobs().catch((error) => {
    console.error('[Metrics Scheduler] Error in initial run:', error);
  });

  // Then run every 10 minutes
  const interval = setInterval(() => {
    scheduleMetricsJobs().catch((error) => {
      console.error('[Metrics Scheduler] Error in scheduled run:', error);
    });
  }, 10 * 60 * 1000); // 10 minutes

  return interval;
}

