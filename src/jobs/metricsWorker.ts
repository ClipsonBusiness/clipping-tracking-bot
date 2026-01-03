import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { YouTubeCollector } from '../collectors/youtubeCollector';
import { TikTokCollector } from '../collectors/tiktokCollector';
import { InstagramCollector } from '../collectors/instagramCollector';

const prisma = new PrismaClient();

// Lazy initialization of collectors to avoid errors if API keys are not set
let youtubeCollector: YouTubeCollector | null = null;
function getYouTubeCollector(): YouTubeCollector {
  if (!youtubeCollector) {
    youtubeCollector = new YouTubeCollector();
  }
  return youtubeCollector;
}

function getTikTokCollector(): TikTokCollector {
  // Use Apify API key
  return new TikTokCollector(process.env.APIFY_API_KEY);
}

function getInstagramCollector(): InstagramCollector {
  // Use Apify API key for profile scraping, SociaVault for metrics
  return new InstagramCollector(
    process.env.APIFY_API_KEY,
    process.env.SOCIAVAULT_API_KEY
  );
}

// Redis connection
const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export interface MetricsJobData {
  submissionId: string;
}

/**
 * Process metrics fetch job
 */
const processMetricsJob = async (job: Job<MetricsJobData>) => {
  const { submissionId } = job.data;
  
  console.log(`[Metrics Worker] Processing job ${job.id} for submission ${submissionId}`);

  try {
    // Load submission
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
    });

    if (!submission) {
      throw new Error(`Submission ${submissionId} not found`);
    }

    // Skip if status is REMOVED or REJECTED
    if (submission.status === 'REMOVED' || submission.status === 'REJECTED') {
      console.log(`[Metrics Worker] Skipping submission ${submissionId} - status is ${submission.status}`);
      return { skipped: true, reason: submission.status };
    }

    // Fetch metrics based on platform
    let metrics;
    try {
      if (submission.platform === 'YOUTUBE') {
        metrics = await getYouTubeCollector().fetchVideoMetrics(submission.contentId);
      } else if (submission.platform === 'TIKTOK') {
        // For TikTok, use canonicalUrl if available, otherwise use contentId
        const videoUrl = submission.canonicalUrl || submission.contentId;
        metrics = await getTikTokCollector().fetchVideoMetrics(videoUrl);
      } else if (submission.platform === 'INSTAGRAM') {
        metrics = await getInstagramCollector().fetchMediaMetrics(submission.contentId);
      } else {
        console.log(`[Metrics Worker] Skipping submission ${submissionId} - unsupported platform: ${submission.platform}`);
        return { skipped: true, reason: `Unsupported platform: ${submission.platform}` };
      }
    } catch (error) {
      console.error(`[Metrics Worker] Error fetching metrics for ${submission.platform} submission ${submissionId}:`, error);
      throw error;
    }

    const now = new Date();

    // Insert MetricSnapshot row
    await prisma.metricSnapshot.create({
      data: {
        submissionId: submission.id,
        capturedAt: now,
        views: metrics.views,
        likes: metrics.likes,
        comments: metrics.comments,
        shares: metrics.shares || 0,
      },
    });

    // Update Submission latest metrics
    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        latestViews: metrics.views,
        latestLikes: metrics.likes,
        latestComments: metrics.comments,
        latestShares: metrics.shares || 0,
        lastMetricsAt: now,
      },
    });

    console.log(`[Metrics Worker] Successfully updated metrics for submission ${submissionId}`);
    return {
      submissionId,
      metrics: {
        views: metrics.views,
        likes: metrics.likes,
        comments: metrics.comments,
      },
    };
  } catch (error) {
    console.error(`[Metrics Worker] Error processing job ${job.id}:`, error);
    throw error;
  }
};

// Create and start metrics worker
export const metricsWorker = new Worker<MetricsJobData>(
  'metrics',
  processMetricsJob,
  {
    connection,
    concurrency: 5, // Process up to 5 jobs concurrently
  }
);

// Worker event handlers
metricsWorker.on('completed', (job) => {
  console.log(`[Metrics Worker] Job ${job?.id} completed successfully`);
});

metricsWorker.on('failed', (job, err) => {
  console.error(`[Metrics Worker] Job ${job?.id} failed:`, err.message);
});

metricsWorker.on('error', (err) => {
  console.error('[Metrics Worker] Worker error:', err);
});

console.log('[Metrics Worker] Metrics worker started');

