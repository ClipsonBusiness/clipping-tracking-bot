import { Router, Request, Response } from 'express';
import { getPrismaClient } from '../utils/prisma';

const router = Router();

/**
 * GET /admin/submissions
 * Admin-only endpoint to list submissions with filtering, pagination, and summary
 */
router.get('/submissions', async (req: Request, res: Response) => {
  try {
    // Parse query parameters
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const status = req.query.status as string | undefined;
    const platform = req.query.platform as string | undefined;
    const search = req.query.search as string | undefined;
    const campaignId = req.query.campaignId as string | undefined;

    // Build where clause for filtering
    const whereConditions: any[] = [];
    
    if (campaignId) {
      whereConditions.push({ campaignId });
    }

    if (status) {
      whereConditions.push({ status });
    }

    if (platform) {
      whereConditions.push({ platform });
    }

    // Search by creator email OR handle
    if (search) {
      whereConditions.push({
        OR: [
          {
            user: {
              email: {
                contains: search,
                mode: 'insensitive',
              },
            },
          },
          {
            user: {
              socialAccounts: {
                some: {
                  handle: {
                    contains: search,
                    mode: 'insensitive',
                  },
                  status: 'VERIFIED',
                },
              },
            },
          },
        ],
      });
    }

    // Combine all conditions with AND
    const where = whereConditions.length > 0 ? { AND: whereConditions } : {};

    // Get total count for pagination
    const total = await getPrismaClient().submission.count({ where });

    // Calculate summary statistics using aggregation
    const summaryData = await getPrismaClient().submission.aggregate({
      where,
      _count: {
        id: true,
      },
      _sum: {
        latestViews: true,
        latestLikes: true,
        latestComments: true,
        latestShares: true,
      },
    });

    // Count approved submissions
    const approvedCount = await getPrismaClient().submission.count({
      where: {
        ...where,
        status: 'APPROVED',
      },
    });

    // Calculate average engagement rate
    const totalViews = summaryData._sum.latestViews || 0;
    const totalEngagement = (summaryData._sum.latestLikes || 0) + 
                           (summaryData._sum.latestComments || 0) + 
                           (summaryData._sum.latestShares || 0);
    const averageEngagementRate = totalViews > 0 
      ? (totalEngagement / totalViews) * 100 
      : 0;

    // Parse sort parameter
    const sort = req.query.sort as string | undefined;
    let orderBy: any = { createdAt: 'desc' }; // Default: newest first
    
    if (sort === 'oldest') {
      orderBy = { createdAt: 'asc' };
    } else if (sort === 'views-desc') {
      orderBy = { latestViews: 'desc' };
    } else if (sort === 'views-asc') {
      orderBy = { latestViews: 'asc' };
    }

    // Fetch submissions with user, campaign, and social account data (optimized, no N+1)
    const submissions = await getPrismaClient().submission.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
          },
        },
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // Get handles for each user (batch query to avoid N+1)
    const userIds = submissions.map(s => s.userId);
    const socialAccounts = await getPrismaClient().socialAccount.findMany({
      where: {
        userId: { in: userIds },
                status: 'VERIFIED',
      },
      select: {
        userId: true,
        platform: true,
        handle: true,
      },
    });

    // Create a map of userId -> platform -> handle for quick lookup
    const handleMap = new Map<string, Map<string, string>>();
    socialAccounts.forEach(account => {
      if (!handleMap.has(account.userId)) {
        handleMap.set(account.userId, new Map());
      }
      handleMap.get(account.userId)!.set(account.platform, account.handle);
    });

    // Format response
    const formattedSubmissions = submissions.map(submission => {
      const userHandleMap = handleMap.get(submission.userId);
      const creatorHandle = userHandleMap?.get(submission.platform) || null;

      // Calculate engagement rate for this submission
      const engagement = submission.latestLikes + submission.latestComments + submission.latestShares;
      const engagementRate = submission.latestViews > 0 
        ? (engagement / submission.latestViews) * 100 
        : 0;

      // Safely access campaign with type assertion
      const campaignData = (submission as any).campaign as { id: string; name: string } | null;

      // Safely access user data with type casting
      const userData = submission.user as { id: string; email: string; username: string | null };
      
      return {
        id: submission.id,
        platform: submission.platform,
        status: submission.status,
        creatorId: submission.userId,
        creatorEmail: userData.email,
        creatorUsername: userData.username || null,
        creatorHandle,
        campaign: submission.campaign ? {
          id: (submission.campaign as { id: string; name: string }).id,
          name: (submission.campaign as { id: string; name: string }).name,
        } : null,
        canonicalUrl: submission.canonicalUrl || '',
        thumbnailUrl: null, // Not in schema, return null
        latestViews: submission.latestViews,
        latestLikes: submission.latestLikes,
        latestComments: submission.latestComments,
        latestShares: submission.latestShares,
        engagementRate: Math.round(engagementRate * 100) / 100, // Round to 2 decimal places
        createdAt: submission.createdAt.toISOString(),
        lastMetricsAt: submission.lastMetricsAt?.toISOString() || null,
      };
    });

    res.json({
      summary: {
        totalSubmissions: summaryData._count.id,
        approvedCount,
        totalViews,
        averageEngagementRate: Math.round(averageEngagementRate * 100) / 100, // Round to 2 decimal places
      },
      submissions: formattedSubmissions,
      pagination: {
        page,
        pageSize,
        total,
      },
    });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    
    // Provide more detailed error messages
    if (error instanceof Error) {
      if (error.message.includes('DATABASE_URL') || error.message.includes('PrismaClientInitializationError')) {
        return res.status(503).json({ 
          error: 'Database not configured',
          message: 'DATABASE_URL environment variable is not set.',
          details: error.message
        });
      }
      
      return res.status(500).json({ 
        error: 'Failed to fetch submissions',
        message: error.message,
        details: error.stack
      });
    }
    
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

/**
 * GET /admin/submissions/:id/details
 * Admin-only endpoint to get detailed submission information with snapshots and deltas
 */
router.get('/submissions/:id/details', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Fetch submission with user data
    const submission = await getPrismaClient().submission.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Get creator handle from verified social account
    const socialAccount = await getPrismaClient().socialAccount.findFirst({
      where: {
        userId: submission.userId,
        platform: submission.platform,
                status: 'VERIFIED',
      },
      select: {
        handle: true,
      },
    });

    const creatorHandle = socialAccount?.handle || null;

    // Fetch snapshots (at most 200, ordered ASC by capturedAt)
    const snapshots = await getPrismaClient().metricSnapshot.findMany({
      where: {
        submissionId: id,
      },
      orderBy: {
        capturedAt: 'asc',
      },
      take: 200,
    });

    // Format snapshots
    const formattedSnapshots = snapshots.map(snapshot => ({
      capturedAt: snapshot.capturedAt.toISOString(),
      views: snapshot.views,
      likes: snapshot.likes,
      comments: snapshot.comments,
      shares: snapshot.shares,
    }));

    // Calculate deltas
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get latest snapshot
    const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;

    // Find snapshot closest to 24h ago
    let snapshot24h: typeof snapshots[0] | null = null;
    let minDiff24h = Infinity;
    for (const snapshot of snapshots) {
      const diff = Math.abs(snapshot.capturedAt.getTime() - twentyFourHoursAgo.getTime());
      if (diff < minDiff24h) {
        minDiff24h = diff;
        snapshot24h = snapshot;
      }
    }

    // Find snapshot closest to 7d ago
    let snapshot7d: typeof snapshots[0] | null = null;
    let minDiff7d = Infinity;
    for (const snapshot of snapshots) {
      const diff = Math.abs(snapshot.capturedAt.getTime() - sevenDaysAgo.getTime());
      if (diff < minDiff7d) {
        minDiff7d = diff;
        snapshot7d = snapshot;
      }
    }

    // Calculate deltas
    const deltas = {
      views24h: latestSnapshot && snapshot24h 
        ? latestSnapshot.views - snapshot24h.views 
        : 0,
      views7d: latestSnapshot && snapshot7d 
        ? latestSnapshot.views - snapshot7d.views 
        : 0,
      likes24h: latestSnapshot && snapshot24h 
        ? latestSnapshot.likes - snapshot24h.likes 
        : 0,
      comments24h: latestSnapshot && snapshot24h 
        ? latestSnapshot.comments - snapshot24h.comments 
        : 0,
      shares24h: latestSnapshot && snapshot24h 
        ? latestSnapshot.shares - snapshot24h.shares 
        : 0,
    };

    // Format submission with all fields
    const formattedSubmission = {
      id: submission.id,
      userId: submission.userId,
      platform: submission.platform,
      contentId: submission.contentId,
      canonicalUrl: submission.canonicalUrl,
      authorPlatformUserId: submission.authorPlatformUserId,
      status: submission.status,
      rejectionReason: submission.rejectionReason,
      latestViews: submission.latestViews,
      latestLikes: submission.latestLikes,
      latestComments: submission.latestComments,
      latestShares: submission.latestShares,
      lastMetricsAt: submission.lastMetricsAt?.toISOString() || null,
      viewsAtApproval: submission.viewsAtApproval,
      approvedAt: submission.approvedAt?.toISOString() || null,
      approvedBy: submission.approvedBy,
      createdAt: submission.createdAt.toISOString(),
      updatedAt: submission.updatedAt.toISOString(),
      creatorEmail: submission.user.email,
      creatorHandle,
    };

    res.json({
      submission: formattedSubmission,
      snapshots: formattedSnapshots,
      deltas,
    });
  } catch (error) {
    console.error('Error fetching submission details:', error);
    res.status(500).json({ error: 'Failed to fetch submission details' });
  }
});

/**
 * POST /admin/submissions/:id/approve
 * Admin-only endpoint to approve a submission
 */
router.post('/submissions/:id/approve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = req.user?.id;

    if (!adminId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Fetch submission
    const submission = await getPrismaClient().submission.findUnique({
      where: { id },
    });

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // If already approved, return existing values (idempotent)
    if (submission.status === 'APPROVED') {
      return res.status(200).json({
        message: 'Submission is already approved',
        submission: {
          id: submission.id,
          status: submission.status,
          approvedAt: submission.approvedAt?.toISOString() || null,
          approvedBy: submission.approvedBy,
          viewsAtApproval: submission.viewsAtApproval,
        },
      });
    }

    // Prepare update data
    const now = new Date();
    const updateData: any = {
        status: 'APPROVED',
      approvedAt: now,
      approvedBy: adminId,
    };

    // If viewsAtApproval is null, set it to latestViews at approval time
    if (submission.viewsAtApproval === null) {
      updateData.viewsAtApproval = submission.latestViews;
    }

    // Update submission
    const updated = await getPrismaClient().submission.update({
      where: { id },
      data: updateData,
    });

    res.status(200).json({
      message: 'Submission approved successfully',
      submission: {
        id: updated.id,
        status: updated.status,
        approvedAt: updated.approvedAt?.toISOString() || null,
        approvedBy: updated.approvedBy,
        viewsAtApproval: updated.viewsAtApproval,
      },
    });
  } catch (error) {
    console.error('Error approving submission:', error);
    res.status(500).json({ error: 'Failed to approve submission' });
  }
});

/**
 * POST /admin/submissions/:id/reject
 * Admin-only endpoint to reject a submission
 */
router.post('/submissions/:id/reject', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Validate reason
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Validation error',
        message: 'reason is required and must be a non-empty string',
      });
    }

    // Fetch submission
    const submission = await getPrismaClient().submission.findUnique({
      where: { id },
    });

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Check if already rejected or removed
    if (submission.status === 'REJECTED') {
      return res.status(200).json({
        message: 'Submission is already rejected',
        submission: {
          id: submission.id,
          status: submission.status,
          rejectionReason: submission.rejectionReason,
        },
      });
    }

    if (submission.status === 'REMOVED') {
      return res.status(400).json({
        error: 'Cannot reject removed submission',
        message: 'This submission has been removed and cannot be rejected',
      });
    }

    // Update submission
    const updated = await getPrismaClient().submission.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason: reason.trim(),
      },
    });

    res.status(200).json({
      message: 'Submission rejected successfully',
      submission: {
        id: updated.id,
        status: updated.status,
        rejectionReason: updated.rejectionReason,
      },
    });
  } catch (error) {
    console.error('Error rejecting submission:', error);
    res.status(500).json({ error: 'Failed to reject submission' });
  }
});

export default router;

