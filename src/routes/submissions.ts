import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { YouTubeCollector } from '../collectors/youtubeCollector';
import { TikTokCollector } from '../collectors/tiktokCollector';
import { InstagramCollector } from '../collectors/instagramCollector';
import { detectPlatformFromUrl, platformToRoute } from '../utils/platformDetector';

const router = Router();
const prisma = new PrismaClient();

// Lazy initialization to avoid errors if API key is not set
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

/**
 * POST /submissions/youtube
 * Creates a submission for a YouTube video
 */
router.post('/youtube', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'url is required and must be a string' });
    }

    // Step 1: Parse YouTube URL
    let parsedUrl;
    try {
      parsedUrl = getYouTubeCollector().parseYouTubeUrl(url);
    } catch (error) {
      return res.status(400).json({ 
        error: 'Invalid YouTube URL',
        message: error instanceof Error ? error.message : 'Failed to parse URL',
      });
    }

    const { videoId, canonicalUrl } = parsedUrl;

    // Check if submission already exists for this video
    const existing = await prisma.submission.findUnique({
      where: {
        platform_contentId: {
          platform: 'YOUTUBE',
          contentId: videoId,
        },
      },
    });

    if (existing) {
      return res.status(409).json({ 
        error: 'Submission already exists for this video',
        submission: existing,
      });
    }

    // Step 2: Fetch initial video metrics
    let videoMetrics;
    try {
      videoMetrics = await getYouTubeCollector().fetchVideoMetrics(videoId);
    } catch (error) {
      return res.status(400).json({ 
        error: 'Failed to fetch video metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Step 3: Resolve video author channel ID
    let authorChannelId;
    try {
      const authorInfo = await getYouTubeCollector().resolveVideoAuthorChannelId(videoId);
      authorChannelId = authorInfo.authorChannelId;
    } catch (error) {
      return res.status(400).json({ 
        error: 'Failed to resolve author channel',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Step 4: Ensure user has a VERIFIED SocialAccount on YOUTUBE with matching platformUserId
    const verifiedAccount = await prisma.socialAccount.findFirst({
      where: {
        userId,
        platform: 'YOUTUBE',
        status: 'VERIFIED',
        platformUserId: authorChannelId,
      },
    });

    if (!verifiedAccount) {
      // Option: Create REJECTED submission or return 403
      // Based on user preference, I'll return 403 without creating
      return res.status(403).json({ 
        error: 'AUTHOR_MISMATCH',
        message: 'You do not have a verified YouTube account matching the video author. Please verify your YouTube account first.',
        authorChannelId,
      });
    }

    // Step 5: Create Submission with PENDING status
    const now = new Date();
    const submission = await prisma.submission.create({
      data: {
        userId,
        platform: 'YOUTUBE',
        contentId: videoId,
        canonicalUrl,
        authorPlatformUserId: authorChannelId,
        status: 'PENDING',
        latestViews: videoMetrics.views,
        latestLikes: videoMetrics.likes,
        latestComments: videoMetrics.comments,
        latestShares: 0, // YouTube API doesn't provide shares
        lastMetricsAt: now,
        metricSnapshots: {
          create: {
            capturedAt: now,
            views: videoMetrics.views,
            likes: videoMetrics.likes,
            comments: videoMetrics.comments,
            shares: 0,
          },
        },
      },
      include: {
        metricSnapshots: {
          orderBy: {
            capturedAt: 'desc',
          },
          take: 1,
        },
      },
    });

    res.status(201).json(submission);
  } catch (error) {
    console.error('Error creating submission:', error);
    
    // Provide more detailed error messages
    if (error instanceof Error) {
      // Database errors
      if (error.message.includes('DATABASE_URL') || error.message.includes('PrismaClientInitializationError')) {
        return res.status(503).json({ 
          error: 'Database not configured',
          message: 'DATABASE_URL environment variable is not set.',
          details: error.message
        });
      }
      
      // YouTube API errors
      if (error.message.includes('YouTube API') || error.message.includes('API key')) {
        return res.status(400).json({ 
          error: 'YouTube API error',
          message: error.message
        });
      }
      
      // Prisma errors
      if (error.message.includes('prisma') || error.message.includes('Prisma')) {
        return res.status(503).json({ 
          error: 'Database error',
          message: 'Unable to connect to database.',
          details: error.message
        });
      }
      
      return res.status(500).json({ 
        error: 'Failed to create submission',
        message: error.message,
        details: error.stack
      });
    }
    
    res.status(500).json({ error: 'Failed to create submission' });
  }
});

/**
 * POST /submissions/tiktok
 * Creates a submission for a TikTok video
 */
router.post('/tiktok', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'url is required and must be a string' });
    }

    // Step 1: Parse TikTok URL
    let parsedUrl;
    try {
      parsedUrl = getTikTokCollector().parseTikTokUrl(url);
    } catch (error) {
      return res.status(400).json({ 
        error: 'Invalid TikTok URL',
        message: error instanceof Error ? error.message : 'Failed to parse URL',
      });
    }

    const { videoId, canonicalUrl } = parsedUrl;

    // Check if submission already exists
    const existing = await prisma.submission.findUnique({
      where: {
        platform_contentId: {
          platform: 'TIKTOK',
          contentId: videoId,
        },
      },
    });

    if (existing) {
      return res.status(409).json({ 
        error: 'Submission already exists for this video',
        submission: existing,
      });
    }

    // Step 2: Fetch initial video metrics (use original URL for best compatibility with Apify)
    let videoMetrics;
    try {
      console.log(`[TikTok Submission] Attempting to fetch metrics for URL: ${url}`);
      // Use the original URL that was submitted - Apify works best with the exact URL format
      videoMetrics = await getTikTokCollector().fetchVideoMetrics(url);
      console.log(`[TikTok Submission] Successfully fetched metrics:`, videoMetrics);
    } catch (error) {
      console.error(`[TikTok Submission] Error fetching video metrics:`, error);
      return res.status(400).json({ 
        error: 'Failed to fetch video metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined,
        url: url, // Include the URL that failed for debugging
      });
    }

    // Step 3: Resolve video author user ID (use original URL for best compatibility)
    let authorUserId;
    try {
      // Use the original URL that was submitted - Apify works best with the exact URL format
      const authorInfo = await getTikTokCollector().resolveVideoAuthorUserId(url);
      authorUserId = authorInfo.authorUserId;
    } catch (error) {
      return res.status(400).json({ 
        error: 'Failed to resolve author user',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Step 4: Ensure user has a VERIFIED SocialAccount on TIKTOK with matching platformUserId
    // Normalize both IDs to strings for comparison
    const normalizedAuthorUserId = String(authorUserId);
    
    console.log(`[TikTok Submission] Looking for verified account with platformUserId: ${normalizedAuthorUserId}`);
    console.log(`[TikTok Submission] User ID: ${userId}`);
    
    // Get ALL TikTok accounts for this user (regardless of status) to debug
    const allTikTokAccounts = await prisma.socialAccount.findMany({
      where: {
        userId,
        platform: 'TIKTOK',
      },
      select: {
        id: true,
        handle: true,
        platformUserId: true,
        status: true,
        verifiedAt: true,
      },
    });
    
    console.log(`[TikTok Submission] All TikTok accounts for user:`, JSON.stringify(allTikTokAccounts, null, 2));
    
    // Get all verified TikTok accounts for this user to see what we have
    const allVerifiedAccounts = await prisma.socialAccount.findMany({
      where: {
        userId,
        platform: 'TIKTOK',
        status: 'VERIFIED',
      },
      select: {
        id: true,
        handle: true,
        platformUserId: true,
        status: true,
      },
    });
    
    console.log(`[TikTok Submission] Found ${allVerifiedAccounts.length} verified TikTok accounts:`, JSON.stringify(allVerifiedAccounts, null, 2));
    
    const verifiedAccount = await prisma.socialAccount.findFirst({
      where: {
        userId,
        platform: 'TIKTOK',
        status: 'VERIFIED',
        platformUserId: normalizedAuthorUserId,
      },
    });

    if (!verifiedAccount) {
      return res.status(403).json({ 
        error: 'AUTHOR_MISMATCH',
        message: 'You do not have a verified TikTok account matching the video author. Please verify your TikTok account first.',
        authorUserId: normalizedAuthorUserId,
        yourVerifiedAccounts: allVerifiedAccounts.map(acc => ({
          handle: acc.handle,
          platformUserId: acc.platformUserId,
          status: acc.status,
        })),
        allTikTokAccounts: allTikTokAccounts.map(acc => ({
          handle: acc.handle,
          platformUserId: acc.platformUserId,
          status: acc.status,
          verifiedAt: acc.verifiedAt,
        })),
        debug: {
          lookingFor: normalizedAuthorUserId,
          userId: userId,
        },
      });
    }

    // Step 5: Create Submission with PENDING status
    const now = new Date();
    const submission = await prisma.submission.create({
      data: {
        userId,
        platform: 'TIKTOK',
        contentId: videoId,
        canonicalUrl,
        authorPlatformUserId: authorUserId,
        status: 'PENDING',
        latestViews: videoMetrics.views,
        latestLikes: videoMetrics.likes,
        latestComments: videoMetrics.comments,
        latestShares: videoMetrics.shares,
        lastMetricsAt: now,
        metricSnapshots: {
          create: {
            capturedAt: now,
            views: videoMetrics.views,
            likes: videoMetrics.likes,
            comments: videoMetrics.comments,
            shares: videoMetrics.shares,
          },
        },
      },
      include: {
        metricSnapshots: {
          orderBy: {
            capturedAt: 'desc',
          },
          take: 1,
        },
      },
    });

    res.status(201).json(submission);
  } catch (error) {
    console.error('Error creating TikTok submission:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('DATABASE_URL') || error.message.includes('PrismaClientInitializationError')) {
        return res.status(503).json({ 
          error: 'Database not configured',
          message: 'DATABASE_URL environment variable is not set.',
          details: error.message
        });
      }
      
      return res.status(500).json({ 
        error: 'Failed to create submission',
        message: error.message,
      });
    }
    
    res.status(500).json({ error: 'Failed to create submission' });
  }
});

/**
 * POST /submissions/instagram
 * Creates a submission for an Instagram post/reel
 */
router.post('/instagram', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'url is required and must be a string' });
    }

    // Step 1: Parse Instagram URL
    let parsedUrl;
    try {
      parsedUrl = getInstagramCollector().parseInstagramUrl(url);
    } catch (error) {
      return res.status(400).json({ 
        error: 'Invalid Instagram URL',
        message: error instanceof Error ? error.message : 'Failed to parse URL',
      });
    }

    const { mediaId, canonicalUrl } = parsedUrl;

    // Check if submission already exists
    const existing = await prisma.submission.findUnique({
      where: {
        platform_contentId: {
          platform: 'INSTAGRAM',
          contentId: mediaId,
        },
      },
    });

    if (existing) {
      return res.status(409).json({ 
        error: 'Submission already exists for this post',
        submission: existing,
      });
    }

    // Step 2: Fetch initial media metrics (use canonicalUrl for better compatibility)
    let mediaMetrics;
    try {
      // Use canonicalUrl if available, otherwise use mediaId
      const mediaUrl = canonicalUrl || mediaId;
      mediaMetrics = await getInstagramCollector().fetchMediaMetrics(mediaUrl);
    } catch (error) {
      return res.status(400).json({ 
        error: 'Failed to fetch media metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Step 3: Resolve media author user ID (use canonicalUrl for better compatibility)
    let authorUserId;
    try {
      // Use canonicalUrl if available, otherwise use mediaId
      const mediaUrl = canonicalUrl || mediaId;
      console.log(`[Instagram Submission] Resolving author for URL: ${mediaUrl}`);
      const authorInfo = await getInstagramCollector().resolveMediaAuthorUserId(mediaUrl);
      authorUserId = authorInfo.authorUserId;
      console.log(`[Instagram Submission] ✅ Resolved author ID: ${authorUserId}`);
    } catch (error) {
      console.error(`[Instagram Submission] ❌ Failed to resolve author:`, error);
      return res.status(400).json({ 
        error: 'Failed to resolve author user',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined,
      });
    }

    // Step 4: Ensure user has a VERIFIED SocialAccount on INSTAGRAM with matching platformUserId
    const verifiedAccount = await prisma.socialAccount.findFirst({
      where: {
        userId,
        platform: 'INSTAGRAM',
        status: 'VERIFIED',
        platformUserId: authorUserId,
      },
    });

    if (!verifiedAccount) {
      return res.status(403).json({ 
        error: 'AUTHOR_MISMATCH',
        message: 'You do not have a verified Instagram account matching the post author. Please verify your Instagram account first.',
        authorUserId,
      });
    }

    // Step 5: Create Submission with PENDING status
    const now = new Date();
    const submission = await prisma.submission.create({
      data: {
        userId,
        platform: 'INSTAGRAM',
        contentId: mediaId,
        canonicalUrl,
        authorPlatformUserId: authorUserId,
        status: 'PENDING',
        latestViews: mediaMetrics.views,
        latestLikes: mediaMetrics.likes,
        latestComments: mediaMetrics.comments,
        latestShares: mediaMetrics.shares,
        lastMetricsAt: now,
        metricSnapshots: {
          create: {
            capturedAt: now,
            views: mediaMetrics.views,
            likes: mediaMetrics.likes,
            comments: mediaMetrics.comments,
            shares: mediaMetrics.shares,
          },
        },
      },
      include: {
        metricSnapshots: {
          orderBy: {
            capturedAt: 'desc',
          },
          take: 1,
        },
      },
    });

    res.status(201).json(submission);
  } catch (error) {
    console.error('Error creating Instagram submission:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('DATABASE_URL') || error.message.includes('PrismaClientInitializationError')) {
        return res.status(503).json({ 
          error: 'Database not configured',
          message: 'DATABASE_URL environment variable is not set.',
          details: error.message
        });
      }
      
      return res.status(500).json({ 
        error: 'Failed to create submission',
        message: error.message,
      });
    }
    
    res.status(500).json({ error: 'Failed to create submission' });
  }
});

/**
 * POST /submissions/:platform/batch
 * Batch submit multiple videos/posts at once
 * Body: { urls: string[] }
 */
router.post('/:platform/batch', async (req: Request, res: Response) => {
  try {
    const { platform } = req.params;
    const { urls } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ 
        error: 'urls must be a non-empty array of strings' 
      });
    }

    if (urls.length > 50) {
      return res.status(400).json({ 
        error: 'Maximum 50 URLs per batch request' 
      });
    }

    // Validate platform
    const validPlatforms = ['youtube', 'tiktok', 'instagram'];
    if (!validPlatforms.includes(platform.toLowerCase())) {
      return res.status(400).json({ 
        error: 'Invalid platform',
        message: `Platform must be one of: ${validPlatforms.join(', ')}`,
      });
    }

    const platformUpper = platform.toUpperCase();
    const results: Array<{
      url: string;
      success: boolean;
      submission?: any;
      error?: string;
    }> = [];

    // Process submissions in parallel (with concurrency limit)
    const CONCURRENCY_LIMIT = 5; // Process 5 at a time to avoid rate limits
    const batches: string[][] = [];
    for (let i = 0; i < urls.length; i += CONCURRENCY_LIMIT) {
      batches.push(urls.slice(i, i + CONCURRENCY_LIMIT));
    }

    for (const batch of batches) {
      const batchPromises = batch.map(async (url) => {
        try {
          // Reuse the existing submission logic by calling the single submission endpoint internally
          // But we'll process it directly here to avoid HTTP overhead
          let submission;
          
          if (platformUpper === 'YOUTUBE') {
            // Parse URL
            const parsedUrl = getYouTubeCollector().parseYouTubeUrl(url);
            const { videoId, canonicalUrl } = parsedUrl;

            // Check if exists
            const existing = await prisma.submission.findUnique({
              where: {
                platform_contentId: {
                  platform: 'YOUTUBE',
                  contentId: videoId,
                },
              },
            });

            if (existing) {
              return { url, success: false, error: 'Submission already exists', submission: existing };
            }

            // Fetch metrics and resolve author
            const videoMetrics = await getYouTubeCollector().fetchVideoMetrics(videoId);
            const authorInfo = await getYouTubeCollector().resolveVideoAuthorChannelId(videoId);
            const authorChannelId = authorInfo.authorChannelId;

            // Check verified account
            const verifiedAccount = await prisma.socialAccount.findFirst({
              where: {
                userId,
                platform: 'YOUTUBE',
                status: 'VERIFIED',
                platformUserId: authorChannelId,
              },
            });

            if (!verifiedAccount) {
              return { url, success: false, error: 'AUTHOR_MISMATCH' };
            }

            // Create submission
            const now = new Date();
            submission = await prisma.submission.create({
              data: {
                userId,
                platform: 'YOUTUBE',
                contentId: videoId,
                canonicalUrl,
                authorPlatformUserId: authorChannelId,
                status: 'PENDING',
                latestViews: videoMetrics.views,
                latestLikes: videoMetrics.likes,
                latestComments: videoMetrics.comments,
                latestShares: videoMetrics.shares || 0,
                lastMetricsAt: now,
                metricSnapshots: {
                  create: {
                    capturedAt: now,
                    views: videoMetrics.views,
                    likes: videoMetrics.likes,
                    comments: videoMetrics.comments,
                    shares: videoMetrics.shares || 0,
                  },
                },
              },
              include: {
                metricSnapshots: true,
              },
            });

          } else if (platformUpper === 'TIKTOK') {
            const parsedUrl = getTikTokCollector().parseTikTokUrl(url);
            const { videoId, canonicalUrl } = parsedUrl;

            const existing = await prisma.submission.findUnique({
              where: {
                platform_contentId: {
                  platform: 'TIKTOK',
                  contentId: videoId,
                },
              },
            });

            if (existing) {
              return { url, success: false, error: 'Submission already exists', submission: existing };
            }

            const videoMetrics = await getTikTokCollector().fetchVideoMetrics(url);
            const authorInfo = await getTikTokCollector().resolveVideoAuthorUserId(url);
            const authorUserId = String(authorInfo.authorUserId);

            const verifiedAccount = await prisma.socialAccount.findFirst({
              where: {
                userId,
                platform: 'TIKTOK',
                status: 'VERIFIED',
                platformUserId: authorUserId,
              },
            });

            if (!verifiedAccount) {
              return { url, success: false, error: 'AUTHOR_MISMATCH' };
            }

            const now = new Date();
            submission = await prisma.submission.create({
              data: {
                userId,
                platform: 'TIKTOK',
                contentId: videoId,
                canonicalUrl,
                authorPlatformUserId: authorUserId,
                status: 'PENDING',
                latestViews: videoMetrics.views,
                latestLikes: videoMetrics.likes,
                latestComments: videoMetrics.comments,
                latestShares: videoMetrics.shares || 0,
                lastMetricsAt: now,
                metricSnapshots: {
                  create: {
                    capturedAt: now,
                    views: videoMetrics.views,
                    likes: videoMetrics.likes,
                    comments: videoMetrics.comments,
                    shares: videoMetrics.shares || 0,
                  },
                },
              },
              include: {
                metricSnapshots: true,
              },
            });

          } else if (platformUpper === 'INSTAGRAM') {
            const parsedUrl = getInstagramCollector().parseInstagramUrl(url);
            const { mediaId, canonicalUrl } = parsedUrl;

            const existing = await prisma.submission.findUnique({
              where: {
                platform_contentId: {
                  platform: 'INSTAGRAM',
                  contentId: mediaId,
                },
              },
            });

            if (existing) {
              return { url, success: false, error: 'Submission already exists', submission: existing };
            }

            // Use original URL (not just mediaId) so username extraction can work
            const mediaUrl = url || canonicalUrl || mediaId;
            const mediaMetrics = await getInstagramCollector().fetchMediaMetrics(mediaUrl);
            const authorInfo = await getInstagramCollector().resolveMediaAuthorUserId(mediaUrl);
            const authorUserId = String(authorInfo.authorUserId);

            const verifiedAccount = await prisma.socialAccount.findFirst({
              where: {
                userId,
                platform: 'INSTAGRAM',
                status: 'VERIFIED',
                platformUserId: authorUserId,
              },
            });

            if (!verifiedAccount) {
              return { url, success: false, error: 'AUTHOR_MISMATCH' };
            }

            const now = new Date();
            submission = await prisma.submission.create({
              data: {
                userId,
                platform: 'INSTAGRAM',
                contentId: mediaId,
                canonicalUrl,
                authorPlatformUserId: authorUserId,
                status: 'PENDING',
                latestViews: mediaMetrics.views,
                latestLikes: mediaMetrics.likes,
                latestComments: mediaMetrics.comments,
                latestShares: mediaMetrics.shares || 0,
                lastMetricsAt: now,
                metricSnapshots: {
                  create: {
                    capturedAt: now,
                    views: mediaMetrics.views,
                    likes: mediaMetrics.likes,
                    comments: mediaMetrics.comments,
                    shares: mediaMetrics.shares || 0,
                  },
                },
              },
              include: {
                metricSnapshots: true,
              },
            });
          }

          return { url, success: true, submission };
        } catch (error) {
          return {
            url,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Small delay between batches to avoid rate limiting
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    res.status(200).json({
      message: `Processed ${urls.length} submissions`,
      summary: {
        total: urls.length,
        successful: successCount,
        failed: failureCount,
      },
      results,
    });
  } catch (error) {
    console.error('Error in batch submission:', error);
    res.status(500).json({
      error: 'Failed to process batch submission',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /submissions/auto
 * Auto-detect platform from URL and submit
 * Body: { url: string }
 */
router.post('/auto', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'url is required and must be a string' });
    }

    // Auto-detect platform from URL
    const platform = detectPlatformFromUrl(url);

    if (!platform) {
      return res.status(400).json({
        error: 'Unsupported platform',
        message: 'Could not detect platform from URL. Supported platforms: YouTube, TikTok, Instagram',
        url,
      });
    }

    // Forward to the appropriate platform handler
    if (platform === 'YOUTUBE') {
      // Parse URL
      const parsedUrl = getYouTubeCollector().parseYouTubeUrl(url);
      const { videoId, canonicalUrl } = parsedUrl;

      // Check if exists
      const existing = await prisma.submission.findUnique({
        where: {
          platform_contentId: {
            platform: 'YOUTUBE',
            contentId: videoId,
          },
        },
      });

      if (existing) {
        return res.status(409).json({ 
          error: 'Submission already exists for this video',
          submission: existing,
        });
      }

      // Fetch metrics and resolve author
      const videoMetrics = await getYouTubeCollector().fetchVideoMetrics(videoId);
      const authorInfo = await getYouTubeCollector().resolveVideoAuthorChannelId(videoId);
      const authorChannelId = authorInfo.authorChannelId;

      // Check verified account
      const verifiedAccount = await prisma.socialAccount.findFirst({
        where: {
          userId,
          platform: 'YOUTUBE',
          status: 'VERIFIED',
          platformUserId: authorChannelId,
        },
      });

      if (!verifiedAccount) {
        return res.status(403).json({
          error: 'AUTHOR_MISMATCH',
          message: 'You do not have a verified YouTube account matching the video author. Please verify your YouTube account first.',
        });
      }

      // Create submission
      const now = new Date();
      const submission = await prisma.submission.create({
        data: {
          userId,
          platform: 'YOUTUBE',
          contentId: videoId,
          canonicalUrl,
          authorPlatformUserId: authorChannelId,
          status: 'PENDING',
          latestViews: videoMetrics.views,
          latestLikes: videoMetrics.likes,
          latestComments: videoMetrics.comments,
          latestShares: videoMetrics.shares || 0,
          lastMetricsAt: now,
          metricSnapshots: {
            create: {
              capturedAt: now,
              views: videoMetrics.views,
              likes: videoMetrics.likes,
              comments: videoMetrics.comments,
              shares: videoMetrics.shares || 0,
            },
          },
        },
        include: {
          metricSnapshots: true,
        },
      });

      return res.status(201).json(submission);

    } else if (platform === 'TIKTOK') {
      // Parse URL
      const parsedUrl = getTikTokCollector().parseTikTokUrl(url);
      const { videoId, canonicalUrl } = parsedUrl;

      // Check if exists
      const existing = await prisma.submission.findUnique({
        where: {
          platform_contentId: {
            platform: 'TIKTOK',
            contentId: videoId,
          },
        },
      });

      if (existing) {
        return res.status(409).json({ 
          error: 'Submission already exists for this video',
          submission: existing,
        });
      }

      // Fetch metrics and resolve author
      const videoMetrics = await getTikTokCollector().fetchVideoMetrics(url);
      const authorInfo = await getTikTokCollector().resolveVideoAuthorUserId(url);
      const authorUserId = String(authorInfo.authorUserId);

      // Check verified account
      const verifiedAccount = await prisma.socialAccount.findFirst({
        where: {
          userId,
          platform: 'TIKTOK',
          status: 'VERIFIED',
          platformUserId: authorUserId,
        },
      });

      if (!verifiedAccount) {
        return res.status(403).json({
          error: 'AUTHOR_MISMATCH',
          message: 'You do not have a verified TikTok account matching the video author. Please verify your TikTok account first.',
        });
      }

      // Create submission
      const now = new Date();
      const submission = await prisma.submission.create({
        data: {
          userId,
          platform: 'TIKTOK',
          contentId: videoId,
          canonicalUrl,
          authorPlatformUserId: authorUserId,
          status: 'PENDING',
          latestViews: videoMetrics.views,
          latestLikes: videoMetrics.likes,
          latestComments: videoMetrics.comments,
          latestShares: videoMetrics.shares || 0,
          lastMetricsAt: now,
          metricSnapshots: {
            create: {
              capturedAt: now,
              views: videoMetrics.views,
              likes: videoMetrics.likes,
              comments: videoMetrics.comments,
              shares: videoMetrics.shares || 0,
            },
          },
        },
        include: {
          metricSnapshots: true,
        },
      });

      return res.status(201).json(submission);

    } else if (platform === 'INSTAGRAM') {
      // Parse URL
      const parsedUrl = getInstagramCollector().parseInstagramUrl(url);
      const { mediaId, canonicalUrl } = parsedUrl;

      // Check if exists
      const existing = await prisma.submission.findUnique({
        where: {
          platform_contentId: {
            platform: 'INSTAGRAM',
            contentId: mediaId,
          },
        },
      });

      if (existing) {
        return res.status(409).json({ 
          error: 'Submission already exists for this post',
          submission: existing,
        });
      }

      // Fetch metrics and resolve author
      // Use the original URL (not just mediaId) so username extraction can work
      const mediaUrl = url || canonicalUrl || mediaId;
      const mediaMetrics = await getInstagramCollector().fetchMediaMetrics(mediaUrl);
      const authorInfo = await getInstagramCollector().resolveMediaAuthorUserId(mediaUrl);
      const authorUserId = String(authorInfo.authorUserId);

      // Check verified account
      const verifiedAccount = await prisma.socialAccount.findFirst({
        where: {
          userId,
          platform: 'INSTAGRAM',
          status: 'VERIFIED',
          platformUserId: authorUserId,
        },
      });

      if (!verifiedAccount) {
        return res.status(403).json({
          error: 'AUTHOR_MISMATCH',
          message: 'You do not have a verified Instagram account matching the post author. Please verify your Instagram account first.',
        });
      }

      // Create submission
      const now = new Date();
      const submission = await prisma.submission.create({
        data: {
          userId,
          platform: 'INSTAGRAM',
          contentId: mediaId,
          canonicalUrl,
          authorPlatformUserId: authorUserId,
          status: 'PENDING',
          latestViews: mediaMetrics.views,
          latestLikes: mediaMetrics.likes,
          latestComments: mediaMetrics.comments,
          latestShares: mediaMetrics.shares || 0,
          lastMetricsAt: now,
          metricSnapshots: {
            create: {
              capturedAt: now,
              views: mediaMetrics.views,
              likes: mediaMetrics.likes,
              comments: mediaMetrics.comments,
              shares: mediaMetrics.shares || 0,
            },
          },
        },
        include: {
          metricSnapshots: true,
        },
      });

      return res.status(201).json(submission);
    }

    return res.status(400).json({ error: 'Unsupported platform' });
  } catch (error) {
    console.error('Error in auto submission:', error);
    res.status(500).json({
      error: 'Failed to create submission',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

