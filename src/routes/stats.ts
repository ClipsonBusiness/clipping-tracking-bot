import { Router, Request, Response } from 'express';
import { getPrismaClient } from '../utils/prisma';

const router = Router();

/**
 * GET /api/stats
 * Get dashboard statistics for the authenticated clipper
 * Returns: total views, submissions count, likes, engagement, etc.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const prisma = getPrismaClient();

    // Get all submissions for this user
    const submissions = await prisma.submission.findMany({
      where: { userId },
      select: {
        id: true,
        platform: true,
        status: true,
        latestViews: true,
        latestLikes: true,
        latestComments: true,
        latestShares: true,
        createdAt: true,
        approvedAt: true,
        canonicalUrl: true,
        authorPlatformUserId: true,
      },
    });

    // Get user's social accounts to map handles
    const socialAccounts = await prisma.socialAccount.findMany({
      where: { userId },
      select: {
        platform: true,
        handle: true,
        platformUserId: true,
      },
    });

    // Create a map of platformUserId -> handle for quick lookup
    const handleMap = new Map<string, string>();
    socialAccounts.forEach(account => {
      if (account.platformUserId) {
        handleMap.set(account.platformUserId, account.handle);
      }
    });

    // Calculate totals
    const totalSubmissions = submissions.length;
    const totalViews = submissions.reduce((sum, s) => sum + s.latestViews, 0);
    const totalLikes = submissions.reduce((sum, s) => sum + s.latestLikes, 0);
    const totalComments = submissions.reduce((sum, s) => sum + s.latestComments, 0);
    const totalShares = submissions.reduce((sum, s) => sum + s.latestShares, 0);

    // Status breakdown
    const statusBreakdown = {
      PENDING: submissions.filter(s => s.status === 'PENDING').length,
      APPROVED: submissions.filter(s => s.status === 'APPROVED').length,
      REJECTED: submissions.filter(s => s.status === 'REJECTED').length,
      REMOVED: submissions.filter(s => s.status === 'REMOVED').length,
    };

    // Platform breakdown
    const platformBreakdown = submissions.reduce((acc, s) => {
      acc[s.platform] = (acc[s.platform] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate engagement rate (likes + comments + shares) / views
    const totalEngagements = totalLikes + totalComments + totalShares;
    const engagementRate = totalViews > 0 
      ? ((totalEngagements / totalViews) * 100).toFixed(2)
      : '0.00';

    // Get top performing submissions (by views)
    const topSubmissions = [...submissions]
      .sort((a, b) => b.latestViews - a.latestViews)
      .slice(0, 5)
      .map(s => ({
        id: s.id,
        platform: s.platform,
        handle: s.authorPlatformUserId ? handleMap.get(s.authorPlatformUserId) || null : null,
        views: s.latestViews,
        likes: s.latestLikes,
        status: s.status,
        url: s.canonicalUrl,
        createdAt: s.createdAt,
      }));

    // Get recent submissions (last 10)
    const recentSubmissions = [...submissions]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
      .map(s => ({
        id: s.id,
        platform: s.platform,
        handle: s.authorPlatformUserId ? handleMap.get(s.authorPlatformUserId) || null : null,
        status: s.status,
        views: s.latestViews,
        likes: s.latestLikes,
        url: s.canonicalUrl,
        createdAt: s.createdAt,
      }));

    // Calculate growth metrics (if we have metric snapshots)
    const submissionsWithSnapshots = await prisma.submission.findMany({
      where: { userId },
      include: {
        metricSnapshots: {
          orderBy: { capturedAt: 'desc' },
          take: 2,
        },
      },
    });

    // Calculate 24h growth for submissions that have snapshots
    let totalViews24h = 0;
    let totalLikes24h = 0;
    
    submissionsWithSnapshots.forEach(submission => {
      if (submission.metricSnapshots.length >= 2) {
        const latest = submission.metricSnapshots[0];
        const previous = submission.metricSnapshots[1];
        const hoursDiff = (new Date(latest.capturedAt).getTime() - new Date(previous.capturedAt).getTime()) / (1000 * 60 * 60);
        
        if (hoursDiff <= 24) {
          totalViews24h += latest.views - previous.views;
          totalLikes24h += latest.likes - previous.likes;
        }
      }
    });

    res.json({
      summary: {
        totalSubmissions,
        totalViews,
        totalLikes,
        totalComments,
        totalShares,
        totalEngagements,
        engagementRate: parseFloat(engagementRate),
        averageViewsPerSubmission: totalSubmissions > 0 
          ? Math.round(totalViews / totalSubmissions) 
          : 0,
      },
      statusBreakdown,
      platformBreakdown,
      growth: {
        views24h: totalViews24h,
        likes24h: totalLikes24h,
      },
      topSubmissions,
      recentSubmissions,
    });
  } catch (error: any) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch statistics',
      message: error?.message 
    });
  }
});

/**
 * GET /api/stats/submissions
 * Get detailed list of all user's submissions with pagination
 */
router.get('/submissions', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const status = req.query.status as string | undefined;
    const platform = req.query.platform as string | undefined;

    const prisma = getPrismaClient();

    // Build where clause
    const where: any = { userId };
    if (status) where.status = status;
    if (platform) where.platform = platform;

    // Get total count
    const total = await prisma.submission.count({ where });

    // Get submissions
    const submissions = await prisma.submission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        platform: true,
        status: true,
        contentId: true,
        canonicalUrl: true,
        latestViews: true,
        latestLikes: true,
        latestComments: true,
        latestShares: true,
        lastMetricsAt: true,
        createdAt: true,
        approvedAt: true,
        rejectionReason: true,
      },
    });

    res.json({
      submissions,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error: any) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ 
      error: 'Failed to fetch submissions',
      message: error?.message 
    });
  }
});

export default router;

