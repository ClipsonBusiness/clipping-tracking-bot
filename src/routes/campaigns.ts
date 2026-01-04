import { Router, Request, Response } from 'express';
import { getPrismaClient } from '../utils/prisma';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Apply auth middleware
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

    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Campaign name is required' });
    }

    const prisma = getPrismaClient();

    const campaign = await prisma.campaign.create({
      data: {
        name,
        description: description || null,
        status: 'ACTIVE',
      },
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

/**
 * GET /api/campaigns/:id
 * Get campaign details
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

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

    // Check if user is a member
    const membership = await prisma.campaignMember.findUnique({
      where: {
        userId_campaignId: {
          userId,
          campaignId,
        },
      },
    });

    res.json({
      campaign: {
        ...campaign,
        memberCount: campaign._count.members,
        submissionCount: campaign._count.submissions,
        joined: !!membership,
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

export default router;

