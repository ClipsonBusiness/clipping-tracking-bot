import { Router, Request, Response } from 'express';
import { getPrismaClient } from '../utils/prisma';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Public routes (no auth required)
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const campaignId = req.params.id;
    const prisma = getPrismaClient();

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        _count: {
          select: {
            members: true,
            submissions: true,
          },
        },
      },
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json({
      campaign: {
        ...campaign,
        memberCount: campaign._count.members,
        submissionCount: campaign._count.submissions,
      },
    });
  } catch (error: any) {
    console.error('Failed to fetch campaign:', error);
    res.status(500).json({ 
      error: 'Failed to fetch campaign',
      message: error.message,
    });
  }
});

router.get('/:id/analytics', async (req: Request, res: Response) => {
  try {
    const campaignId = req.params.id;
    const prisma = getPrismaClient();

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        targetSubmissions: true,
        minViewsPerClip: true,
      },
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const submissions = await prisma.submission.findMany({
      where: {
        campaignId,
        status: { in: ['PENDING', 'APPROVED'] },
      },
      select: {
        latestViews: true,
        latestLikes: true,
        latestComments: true,
        latestShares: true,
      },
    });

    const totalViews = submissions.reduce((sum, s) => sum + (s.latestViews || 0), 0);
    const totalLikes = submissions.reduce((sum, s) => sum + (s.latestLikes || 0), 0);
    const totalComments = submissions.reduce((sum, s) => sum + (s.latestComments || 0), 0);
    const totalShares = submissions.reduce((sum, s) => sum + (s.latestShares || 0), 0);
    const contentCount = submissions.length;

    const avgEngagement = totalViews > 0 
      ? ((totalLikes + totalComments + totalShares) / totalViews * 100).toFixed(2)
      : '0.00';

    let targetAttainment = '0.0';
    if (campaign.targetSubmissions && campaign.targetSubmissions > 0) {
      targetAttainment = ((contentCount / campaign.targetSubmissions) * 100).toFixed(1);
    } else if (campaign.minViewsPerClip && campaign.minViewsPerClip > 0) {
      const estimatedGoal = campaign.minViewsPerClip * Math.max(1, contentCount);
      targetAttainment = estimatedGoal > 0
        ? ((totalViews / estimatedGoal) * 100).toFixed(1)
        : '0.0';
    }

    res.json({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        targetSubmissions: campaign.targetSubmissions,
        minViewsPerClip: campaign.minViewsPerClip,
      },
      metrics: {
        totalViews,
        totalLikes,
        totalComments,
        totalShares,
        contentCount,
        avgEngagement: parseFloat(avgEngagement),
        targetAttainment: parseFloat(targetAttainment),
      },
    });
  } catch (error: any) {
    console.error('Failed to fetch campaign analytics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch campaign analytics',
      message: error.message,
    });
  }
});

router.get('/:id/submissions', async (req: Request, res: Response) => {
  try {
    const campaignId = req.params.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const platform = req.query.platform as string;
    const status = req.query.status as string;
    const search = req.query.search as string;
    const skip = (page - 1) * limit;

    const prisma = getPrismaClient();

    const where: any = {
      campaignId,
    };

    if (platform && platform !== 'all') {
      where.platform = platform.toUpperCase();
    }

    if (status && status !== 'all') {
      where.status = status.toUpperCase();
    }

    if (search) {
      where.OR = [
        { canonicalUrl: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { user: { username: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [submissions, total] = await Promise.all([
      prisma.submission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              discordId: true,
            },
          },
        },
      }),
      prisma.submission.count({ where }),
    ]);

    const userIds = submissions.map(s => s.userId);
    const socialAccounts = await prisma.socialAccount.findMany({
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

    // Fetch Discord usernames for all users with discordId
    const usersWithDiscord = submissions
      .map(s => s.user)
      .filter((u: any) => u && u.discordId)
      .map((u: any) => u.discordId);
    
    const uniqueDiscordIds = [...new Set(usersWithDiscord)];
    const discordUsernameMap = new Map<string, string | null>();
    
    // Fetch all Discord usernames in parallel
    await Promise.all(
      uniqueDiscordIds.map(async (discordId) => {
        const username = await getDiscordUsername(discordId);
        discordUsernameMap.set(discordId, username);
      })
    );

    const submissionsWithAccounts = submissions.map((submission: any) => {
      const userAccounts = socialAccounts.filter(sa => sa.userId === submission.userId);
      const accountHandle = userAccounts.find(sa => sa.platform === submission.platform)?.handle || null;
      
      // Get discordId from user if available
      const user = submission.user || {};
      const discordUsername = user.discordId ? discordUsernameMap.get(user.discordId) || null : null;

      return {
        id: submission.id,
        platform: submission.platform,
        canonicalUrl: submission.canonicalUrl,
        status: submission.status,
        latestViews: submission.latestViews || 0,
        latestLikes: submission.latestLikes || 0,
        latestComments: submission.latestComments || 0,
        latestShares: submission.latestShares || 0,
        createdAt: submission.createdAt,
        updatedAt: submission.updatedAt,
        creatorHandle: accountHandle,
        discordUsername,
        userEmail: user.email || null,
        userName: user.username || null,
      };
    });

    res.json({
      submissions: submissionsWithAccounts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Failed to fetch campaign submissions:', error);
    res.status(500).json({ 
      error: 'Failed to fetch campaign submissions',
      message: error.message,
    });
  }
});

router.get('/:id/accounts', async (req: Request, res: Response) => {
  try {
    const campaignId = req.params.id;
    const prisma = getPrismaClient();

    const members = await prisma.campaignMember.findMany({
      where: { campaignId },
      select: { userId: true },
    });

    const userIds = members.map(m => m.userId);

    const socialAccounts = await prisma.socialAccount.findMany({
      where: {
        userId: { in: userIds },
        status: 'VERIFIED',
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            discordId: true,
          },
        },
      },
    });

    // Fetch Discord usernames for all users with discordId
    const usersWithDiscord = socialAccounts
      .map((a: any) => a.user)
      .filter((u: any) => u && u.discordId)
      .map((u: any) => u.discordId);
    
    const uniqueDiscordIds = [...new Set(usersWithDiscord)];
    const discordUsernameMap = new Map<string, string | null>();
    
    // Fetch all Discord usernames in parallel
    await Promise.all(
      uniqueDiscordIds.map(async (discordId) => {
        const username = await getDiscordUsername(discordId);
        discordUsernameMap.set(discordId, username);
      })
    );

    const accountStats = await Promise.all(
      socialAccounts.map(async (account: any) => {
        const submissions = await prisma.submission.findMany({
          where: {
            campaignId,
            userId: account.userId,
            platform: account.platform,
            status: { in: ['PENDING', 'APPROVED'] },
          },
          select: {
            latestViews: true,
          },
        });

        const totalViews = submissions.reduce((sum, s) => sum + (s.latestViews || 0), 0);
        const submissionCount = submissions.length;
        const avgViews = submissionCount > 0 ? Math.round(totalViews / submissionCount) : 0;

        const user = account.user || {};
        const discordUsername = user.discordId ? discordUsernameMap.get(user.discordId) || null : null;
        
        return {
          id: account.id,
          platform: account.platform,
          handle: account.handle,
          profileUrl: account.profileUrl,
          verifiedAt: account.verifiedAt,
          discordUsername,
          userEmail: user.email || null,
          userName: user.username || null,
          totalViews,
          submissionCount,
          avgViews,
        };
      })
    );

    const platformBreakdown = accountStats.reduce((acc, account) => {
      if (!acc[account.platform]) {
        acc[account.platform] = {
          totalAccounts: 0,
          verifiedAccounts: 0,
          totalViews: 0,
          totalSubmissions: 0,
        };
      }
      acc[account.platform].totalAccounts++;
      acc[account.platform].verifiedAccounts++;
      acc[account.platform].totalViews += account.totalViews;
      acc[account.platform].totalSubmissions += account.submissionCount;
      return acc;
    }, {} as Record<string, any>);

    Object.keys(platformBreakdown).forEach(platform => {
      const stats = platformBreakdown[platform];
      stats.avgViewsPerSubmission = stats.totalSubmissions > 0
        ? Math.round(stats.totalViews / stats.totalSubmissions)
        : 0;
    });

    res.json({
      accounts: accountStats,
      statistics: {
        totalAccounts: accountStats.length,
        verifiedAccounts: accountStats.length,
        platforms: Object.keys(platformBreakdown).length,
        totalViews: accountStats.reduce((sum, a) => sum + a.totalViews, 0),
        totalSubmissions: accountStats.reduce((sum, a) => sum + a.submissionCount, 0),
      },
      platformBreakdown,
    });
  } catch (error: any) {
    console.error('Failed to fetch campaign accounts:', error);
    res.status(500).json({ 
      error: 'Failed to fetch campaign accounts',
      message: error.message,
    });
  }
});

// Apply auth middleware to remaining routes
router.use(authMiddleware);

/**
 * GET /api/campaigns
 * List all active campaigns
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const prisma = getPrismaClient();
    
    // Get all active campaigns with member count
    const campaigns = await prisma.campaign.findMany({
      where: {
        status: 'ACTIVE',
      },
      include: {
        _count: {
          select: {
            members: true,
            submissions: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Check which campaigns the user has joined
    const userMemberships = await prisma.campaignMember.findMany({
      where: { userId },
      select: { campaignId: true },
    });
    const joinedCampaignIds = new Set(userMemberships.map(m => m.campaignId));

    // Add joined status to each campaign
    const campaignsWithStatus = campaigns.map(campaign => ({
      id: campaign.id,
      name: campaign.name,
      description: campaign.description,
      status: campaign.status,
      createdAt: campaign.createdAt,
      memberCount: campaign._count.members,
      submissionCount: campaign._count.submissions,
      joined: joinedCampaignIds.has(campaign.id),
    }));

    res.json({ campaigns: campaignsWithStatus });
  } catch (error: any) {
    console.error('Failed to fetch campaigns:', error);
    res.status(500).json({ 
      error: 'Failed to fetch campaigns',
      message: error.message,
    });
  }
});

/**
 * POST /api/campaigns
 * Create a new campaign (Admin only)
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId || userRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const {
      companyName,
      name,
      identifier,
      managerCode,
      status = 'ACTIVE',
      campaignType = 'PUBLIC',
      shortDescription,
      description,
      allowedUserTypes,
      acceptedPlatforms,
      discordServerId,
      discordRoleId,
      discordInviteLink,
      startDate,
      endDate,
      contentGuidelines,
      campaignRules,
      requiredHashtags,
      bannedHashtags,
      maxContentAgeHours,
      targetSubmissions,
      payoutPerLink,
      totalBudget,
      payoutType,
      minViewsForPayout,
      minViewsPerClip,
      maxPayoutPerCreator,
      dailyBudgetLimit,
    } = req.body;

    if (!name || !companyName || !shortDescription || !description) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['companyName', 'name', 'shortDescription', 'description']
      });
    }

    const prisma = getPrismaClient();

    // If creating an ACTIVE campaign, check if there's already an active one
    if (status === 'ACTIVE' || (!status && true)) {
      const activeCampaigns = await prisma.campaign.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      });

      if (activeCampaigns.length > 0) {
        // Automatically pause all existing active campaigns
        await prisma.campaign.updateMany({
          where: { status: 'ACTIVE' },
          data: { status: 'PAUSED' },
        });

        console.log(`[Campaign] Paused ${activeCampaigns.length} existing active campaign(s) before creating new one`);
      }
    }

    // Build campaign data object with all available fields
    const campaignData: any = {
      name,
      description: description || null,
      status: status || 'ACTIVE',
    };

    // Add optional fields if they exist in schema (will be added after migration)
    // For now, store JSON fields as strings
    if (companyName) campaignData.companyName = companyName;
    if (identifier) campaignData.identifier = identifier;
    if (managerCode) campaignData.managerCode = managerCode;
    if (campaignType) campaignData.campaignType = campaignType;
    if (shortDescription) campaignData.shortDescription = shortDescription;
    if (allowedUserTypes) campaignData.allowedUserTypes = typeof allowedUserTypes === 'string' ? allowedUserTypes : JSON.stringify(allowedUserTypes);
    if (acceptedPlatforms) campaignData.acceptedPlatforms = typeof acceptedPlatforms === 'string' ? acceptedPlatforms : JSON.stringify(acceptedPlatforms);
    if (discordServerId) campaignData.discordServerId = discordServerId;
    if (discordRoleId) campaignData.discordRoleId = discordRoleId;
    if (discordInviteLink) campaignData.discordInviteLink = discordInviteLink;
    if (startDate) campaignData.startDate = new Date(startDate);
    if (endDate) campaignData.endDate = new Date(endDate);
    if (contentGuidelines) campaignData.contentGuidelines = contentGuidelines;
    if (campaignRules) campaignData.campaignRules = campaignRules;
    if (requiredHashtags) campaignData.requiredHashtags = requiredHashtags;
    if (bannedHashtags) campaignData.bannedHashtags = bannedHashtags;
    if (maxContentAgeHours !== undefined) campaignData.maxContentAgeHours = maxContentAgeHours;
    if (targetSubmissions !== undefined) campaignData.targetSubmissions = targetSubmissions;
    if (payoutPerLink !== undefined) campaignData.payoutPerLink = payoutPerLink;
    if (totalBudget !== undefined) campaignData.totalBudget = totalBudget;
    if (payoutType) campaignData.payoutType = payoutType;
    if (minViewsForPayout !== undefined) campaignData.minViewsForPayout = minViewsForPayout;
    if (minViewsPerClip !== undefined) campaignData.minViewsPerClip = minViewsPerClip;
    if (maxPayoutPerCreator !== undefined) campaignData.maxPayoutPerCreator = maxPayoutPerCreator;
    if (dailyBudgetLimit !== undefined) campaignData.dailyBudgetLimit = dailyBudgetLimit;

    const campaign = await prisma.campaign.create({
      data: campaignData,
    });

    res.status(201).json({ campaign });
  } catch (error: any) {
    console.error('Failed to create campaign:', error);
    res.status(500).json({ 
      error: 'Failed to create campaign',
      message: error.message,
    });
  }
});

/**
 * POST /api/campaigns/:id/join
 * Join a campaign
 */
router.post('/:id/join', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const campaignId = req.params.id;
    const prisma = getPrismaClient();

    // Check if campaign exists and is active
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    if (campaign.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Campaign is not active' });
    }

    // Check if already a member
    const existing = await prisma.campaignMember.findUnique({
      where: {
        userId_campaignId: {
          userId,
          campaignId,
        },
      },
    });

    if (existing) {
      return res.status(409).json({ error: 'Already a member of this campaign' });
    }

    // Join the campaign
    await prisma.campaignMember.create({
      data: {
        userId,
        campaignId,
      },
    });

    res.json({ 
      success: true,
      message: 'Successfully joined campaign',
    });
  } catch (error: any) {
    console.error('Failed to join campaign:', error);
    res.status(500).json({ 
      error: 'Failed to join campaign',
      message: error.message,
    });
  }
});

// Duplicate route removed - handled above as public route

/**
 * PUT /api/campaigns/:id
 * Update a campaign (Admin only)
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId || userRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const {
      startDate,
      endDate,
      minViewsPerClip,
      payoutPerLink,
      totalBudget,
      acceptedPlatforms,
    } = req.body;

    const prisma = getPrismaClient();

    // Check if campaign exists
    const existingCampaign = await prisma.campaign.findUnique({
      where: { id },
    });

    if (!existingCampaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Build update data object
    const updateData: any = {};

    if (startDate !== undefined) updateData.startDate = new Date(startDate);
    if (endDate !== undefined) updateData.endDate = new Date(endDate);
    if (minViewsPerClip !== undefined) updateData.minViewsPerClip = minViewsPerClip;
    if (payoutPerLink !== undefined) updateData.payoutPerLink = payoutPerLink;
    if (totalBudget !== undefined) updateData.totalBudget = totalBudget;
    if (acceptedPlatforms !== undefined) {
      updateData.acceptedPlatforms = Array.isArray(acceptedPlatforms) 
        ? JSON.stringify(acceptedPlatforms) 
        : acceptedPlatforms;
    }

    const campaign = await prisma.campaign.update({
      where: { id },
      data: updateData,
    });

    res.status(200).json({ campaign });
  } catch (error: any) {
    console.error('Failed to update campaign:', error);
    res.status(500).json({ 
      error: 'Failed to update campaign',
      message: error.message,
    });
  }
});

// Duplicate analytics route removed - handled above as public route

/**
 * GET /api/campaigns/:id/submissions (DUPLICATE - REMOVE)
 */
router.get('/:id/submissions', async (req: Request, res: Response) => {
  try {
    const campaignId = req.params.id;
    const prisma = getPrismaClient();

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        targetSubmissions: true,
        minViewsPerClip: true,
      },
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Get all submissions for this campaign
    const submissions = await prisma.submission.findMany({
      where: {
        campaignId,
        status: { in: ['PENDING', 'APPROVED'] },
      },
      select: {
        latestViews: true,
        latestLikes: true,
        latestComments: true,
        latestShares: true,
      },
    });

    // Calculate totals
    const totalViews = submissions.reduce((sum, s) => sum + (s.latestViews || 0), 0);
    const totalLikes = submissions.reduce((sum, s) => sum + (s.latestLikes || 0), 0);
    const totalComments = submissions.reduce((sum, s) => sum + (s.latestComments || 0), 0);
    const totalShares = submissions.reduce((sum, s) => sum + (s.latestShares || 0), 0);
    const contentCount = submissions.length;

    // Calculate engagement rate
    const avgEngagement = totalViews > 0 
      ? ((totalLikes + totalComments + totalShares) / totalViews * 100).toFixed(2)
      : '0.00';

    // Calculate target attainment
    let targetAttainment = '0.0';
    if (campaign.targetSubmissions && campaign.targetSubmissions > 0) {
      targetAttainment = ((contentCount / campaign.targetSubmissions) * 100).toFixed(1);
    } else if (campaign.minViewsPerClip && campaign.minViewsPerClip > 0) {
      const estimatedGoal = campaign.minViewsPerClip * Math.max(1, contentCount);
      targetAttainment = estimatedGoal > 0
        ? ((totalViews / estimatedGoal) * 100).toFixed(1)
        : '0.0';
    }

    res.json({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        targetSubmissions: campaign.targetSubmissions,
        minViewsPerClip: campaign.minViewsPerClip,
      },
      metrics: {
        totalViews,
        totalLikes,
        totalComments,
        totalShares,
        contentCount,
        avgEngagement: parseFloat(avgEngagement),
        targetAttainment: parseFloat(targetAttainment),
      },
    });
  } catch (error: any) {
    console.error('Failed to fetch campaign analytics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch campaign analytics',
      message: error.message,
    });
  }
});

// Duplicate routes removed - handled above as public routes

/**
 * POST /api/campaigns/:id/submissions/:submissionId
 * Link a submission to a campaign (Admin only)
 */
router.post('/:id/submissions/:submissionId', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId || userRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id: campaignId, submissionId } = req.params;
    const prisma = getPrismaClient();

    // Verify campaign exists
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Link submission to campaign
    await prisma.submission.update({
      where: { id: submissionId },
      data: { campaignId },
    });

    res.json({ 
      success: true,
      message: 'Submission linked to campaign',
    });
  } catch (error: any) {
    console.error('Failed to link submission to campaign:', error);
    res.status(500).json({ 
      error: 'Failed to link submission to campaign',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/campaigns/:id/submissions/:submissionId
 * Remove a submission from campaign (set campaignId to null)
 */
router.delete('/:id/submissions/:submissionId', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId || userRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { submissionId } = req.params;
    const prisma = getPrismaClient();

    // Remove submission from campaign (set campaignId to null)
    await prisma.submission.update({
      where: { id: submissionId },
      data: { campaignId: null },
    });

    res.json({ 
      success: true,
      message: 'Submission removed from campaign',
    });
  } catch (error: any) {
    console.error('Failed to remove submission from campaign:', error);
    res.status(500).json({ 
      error: 'Failed to remove submission from campaign',
      message: error.message,
    });
  }
});

export default router;

