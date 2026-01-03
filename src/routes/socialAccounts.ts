import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { YouTubeCollector } from '../collectors/youtubeCollector';
import { TikTokCollector } from '../collectors/tiktokCollector';
import { InstagramCollector } from '../collectors/instagramCollector';

const router = Router();
const prisma = new PrismaClient();

// Lazy initialization to avoid errors if API key is not set
// Always create a new instance to ensure fresh API key from env
function getYouTubeCollector(): YouTubeCollector {
  // Always create fresh instance to pick up env changes
  return new YouTubeCollector();
}

function getTikTokCollector(): TikTokCollector {
  // Use Apify API key instead of TikTok access token
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
 * Generate verification code in format ABC12-XYZ789
 */
function generateVerificationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  
  // Generate ABC12 part (3 letters + 2 numbers)
  const part1 = 
    chars[Math.floor(Math.random() * chars.length)] +
    chars[Math.floor(Math.random() * chars.length)] +
    chars[Math.floor(Math.random() * chars.length)] +
    numbers[Math.floor(Math.random() * numbers.length)] +
    numbers[Math.floor(Math.random() * numbers.length)];
  
  // Generate XYZ789 part (3 letters + 3 numbers)
  const part2 = 
    chars[Math.floor(Math.random() * chars.length)] +
    chars[Math.floor(Math.random() * chars.length)] +
    chars[Math.floor(Math.random() * chars.length)] +
    numbers[Math.floor(Math.random() * numbers.length)] +
    numbers[Math.floor(Math.random() * numbers.length)] +
    numbers[Math.floor(Math.random() * numbers.length)];
  
  return `${part1}-${part2}`;
}

/**
 * POST /social-accounts/youtube
 * Creates a SocialAccount with status PENDING and generates verification code
 */
router.post('/youtube', async (req: Request, res: Response) => {
  try {
    const { handle } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!handle || typeof handle !== 'string') {
      return res.status(400).json({ error: 'handle is required and must be a string' });
    }

    // Ensure user exists (create if doesn't exist)
    let user;
    try {
      user = await prisma.user.findUnique({
        where: { id: userId },
      });
      
      if (!user) {
        // Create user if doesn't exist
        user = await prisma.user.create({
          data: {
            id: userId,
            email: `${userId}@example.com`, // Placeholder email
            role: 'CLIPPER',
          },
        });
      }
    } catch (dbError: any) {
      if (dbError.code === 'P1001' || dbError.message?.includes('DATABASE_URL')) {
        return res.status(503).json({ 
          error: 'Database not configured',
          message: 'DATABASE_URL environment variable is not set.',
          details: dbError.message,
        });
      }
      throw dbError;
    }

    // Check if social account already exists
    let existing;
    try {
      existing = await prisma.socialAccount.findUnique({
        where: {
          userId_platform_handle: {
            userId,
            platform: 'YOUTUBE',
            handle: handle.replace('@', ''), // Remove @ if present
          },
        },
      });
    } catch (dbError: any) {
      // Database connection error
      if (dbError.code === 'P1001' || dbError.message?.includes('DATABASE_URL') || dbError.message?.includes('PrismaClientInitializationError')) {
        return res.status(503).json({ 
          error: 'Database not configured',
          message: 'DATABASE_URL environment variable is not set. Please configure your database connection.',
          details: dbError.message,
          help: 'Set DATABASE_URL in your .env file: DATABASE_URL="postgresql://user:password@localhost:5432/dbname"'
        });
      }
      throw dbError;
    }

    if (existing) {
      // If account exists but isn't verified, return the code (or generate new one if expired)
      let code = existing.verificationCode;
      const now = new Date();
      
      // If code is expired or missing, generate a new one
      if (!code || !existing.verificationExpiresAt || existing.verificationExpiresAt < now) {
        code = generateVerificationCode();
        const verificationExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 60 minutes from now
        
        // Update the account with new code
        await prisma.socialAccount.update({
          where: { id: existing.id },
          data: {
            verificationCode: code,
            verificationExpiresAt,
          },
        });
      }
      
      return res.status(409).json({ 
        error: 'Social account already exists',
        socialAccountId: existing.id,
        code: code,
      });
    }

    // Generate verification code
    const verificationCode = generateVerificationCode();
    const verificationExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 60 minutes from now

    // Create social account
    let socialAccount;
    try {
      socialAccount = await prisma.socialAccount.create({
        data: {
          userId,
          platform: 'YOUTUBE',
          handle: handle.replace('@', ''), // Store without @
          platformUserId: '', // Will be set after verification
          verificationCode,
          verificationExpiresAt,
          status: 'PENDING',
        },
      });
    } catch (dbError: any) {
      // Database connection error
      if (dbError.code === 'P1001' || dbError.message?.includes('DATABASE_URL') || dbError.message?.includes('PrismaClientInitializationError')) {
        return res.status(503).json({ 
          error: 'Database not configured',
          message: 'DATABASE_URL environment variable is not set. Please configure your database connection.',
          details: dbError.message,
          help: 'Set DATABASE_URL in your .env file: DATABASE_URL="postgresql://user:password@localhost:5432/dbname"'
        });
      }
      throw dbError;
    }

    const instructions = `Please add the verification code "${verificationCode}" to your YouTube channel description. Then verify your account using the /social-accounts/${socialAccount.id}/verify endpoint.`;

    res.status(201).json({
      socialAccountId: socialAccount.id,
      code: verificationCode,
      instructions,
    });
  } catch (error) {
    console.error('Error creating social account:', error);
    
    // Provide more detailed error messages
    if (error instanceof Error) {
      // Check if it's a database connection error
      if (error.message.includes('DATABASE_URL') || error.message.includes('PrismaClientInitializationError')) {
        return res.status(503).json({ 
          error: 'Database not configured',
          message: 'DATABASE_URL environment variable is not set. Please configure your database connection.',
          details: error.message
        });
      }
      
      // Check if it's a Prisma error
      if (error.message.includes('prisma') || error.message.includes('Prisma')) {
        return res.status(503).json({ 
          error: 'Database error',
          message: 'Unable to connect to database. Please check your DATABASE_URL configuration.',
          details: error.message
        });
      }
      
      return res.status(500).json({ 
        error: 'Failed to create social account',
        message: error.message
      });
    }
    
    res.status(500).json({ error: 'Failed to create social account' });
  }
});

/**
 * POST /social-accounts/tiktok
 * Creates a SocialAccount with status PENDING and generates verification code
 */
router.post('/tiktok', async (req: Request, res: Response) => {
  try {
    const { handle } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!handle || typeof handle !== 'string') {
      return res.status(400).json({ error: 'handle is required and must be a string' });
    }

    // Ensure user exists
    let user;
    try {
      user = await prisma.user.findUnique({
        where: { id: userId },
      });
      
      if (!user) {
        user = await prisma.user.create({
          data: {
            id: userId,
            email: `${userId}@example.com`,
            role: 'CLIPPER',
          },
        });
      }
    } catch (dbError: any) {
      if (dbError.code === 'P1001' || dbError.message?.includes('DATABASE_URL')) {
        return res.status(503).json({ 
          error: 'Database not configured',
          message: 'DATABASE_URL environment variable is not set.',
          details: dbError.message,
        });
      }
      throw dbError;
    }

    // Check if social account already exists
    const existing = await prisma.socialAccount.findUnique({
      where: {
        userId_platform_handle: {
          userId,
          platform: 'TIKTOK',
          handle: handle.replace('@', ''),
        },
      },
    });

    if (existing) {
      // If account exists but isn't verified, return the code (or generate new one if expired)
      let code = existing.verificationCode;
      const now = new Date();
      
      // If code is expired or missing, generate a new one
      if (!code || !existing.verificationExpiresAt || existing.verificationExpiresAt < now) {
        code = generateVerificationCode();
        const verificationExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 60 minutes from now
        
        // Update the account with new code
        await prisma.socialAccount.update({
          where: { id: existing.id },
          data: {
            verificationCode: code,
            verificationExpiresAt,
          },
        });
      }
      
      return res.status(409).json({
        error: 'Social account already exists',
        socialAccountId: existing.id,
        code: code,
      });
    }

    // Generate verification code
    const verificationCode = generateVerificationCode();
    const verificationExpiresAt = new Date();
    verificationExpiresAt.setMinutes(verificationExpiresAt.getMinutes() + 60); // 60 minutes from now

    // Create social account
    const socialAccount = await prisma.socialAccount.create({
      data: {
        userId,
        platform: 'TIKTOK',
        handle: handle.replace('@', ''),
        platformUserId: '',
        verificationCode,
        verificationExpiresAt,
        status: 'PENDING',
      },
    });

    const instructions = `Please add the verification code "${verificationCode}" to your TikTok bio. Then verify your account using the /social-accounts/${socialAccount.id}/verify endpoint.`;

    res.status(201).json({
      socialAccountId: socialAccount.id,
      code: verificationCode,
      instructions,
    });
  } catch (error) {
    console.error('Error creating TikTok social account:', error);
    res.status(500).json({ 
      error: 'Failed to create social account',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /social-accounts/instagram
 * Creates a SocialAccount with status PENDING and generates verification code
 */
router.post('/instagram', async (req: Request, res: Response) => {
  try {
    const { handle } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!handle || typeof handle !== 'string') {
      return res.status(400).json({ error: 'handle is required and must be a string' });
    }

    // Ensure user exists
    let user;
    try {
      user = await prisma.user.findUnique({
        where: { id: userId },
      });
      
      if (!user) {
        user = await prisma.user.create({
          data: {
            id: userId,
            email: `${userId}@example.com`,
            role: 'CLIPPER',
          },
        });
      }
    } catch (dbError: any) {
      if (dbError.code === 'P1001' || dbError.message?.includes('DATABASE_URL')) {
        return res.status(503).json({ 
          error: 'Database not configured',
          message: 'DATABASE_URL environment variable is not set.',
          details: dbError.message,
        });
      }
      throw dbError;
    }

    // Check if social account already exists
    const existing = await prisma.socialAccount.findUnique({
      where: {
        userId_platform_handle: {
          userId,
          platform: 'INSTAGRAM',
          handle: handle.replace('@', ''),
        },
      },
    });

    if (existing) {
      // If account exists but isn't verified, return the code (or generate new one if expired)
      let code = existing.verificationCode;
      const now = new Date();
      
      // If code is expired or missing, generate a new one
      if (!code || !existing.verificationExpiresAt || existing.verificationExpiresAt < now) {
        code = generateVerificationCode();
        const verificationExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 60 minutes from now
        
        // Update the account with new code
        await prisma.socialAccount.update({
          where: { id: existing.id },
          data: {
            verificationCode: code,
            verificationExpiresAt,
          },
        });
      }
      
      return res.status(409).json({
        error: 'Social account already exists',
        socialAccountId: existing.id,
        code: code,
      });
    }

    // Generate verification code
    const verificationCode = generateVerificationCode();
    const verificationExpiresAt = new Date();
    verificationExpiresAt.setMinutes(verificationExpiresAt.getMinutes() + 60); // 60 minutes from now

    // Create social account
    const socialAccount = await prisma.socialAccount.create({
      data: {
        userId,
        platform: 'INSTAGRAM',
        handle: handle.replace('@', ''),
        platformUserId: '',
        verificationCode,
        verificationExpiresAt,
        status: 'PENDING',
      },
    });

    const instructions = `Please add the verification code "${verificationCode}" to your Instagram bio. Then verify your account using the /social-accounts/${socialAccount.id}/verify endpoint.`;

    res.status(201).json({
      socialAccountId: socialAccount.id,
      code: verificationCode,
      instructions,
    });
  } catch (error) {
    console.error('Error creating Instagram social account:', error);
    res.status(500).json({ 
      error: 'Failed to create social account',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /social-accounts/:id/verify
 * Verifies a social account by checking if verification code is in channel description
 */
router.post('/:id/verify', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Load social account
    const socialAccount = await prisma.socialAccount.findUnique({
      where: { id },
    });

    if (!socialAccount) {
      return res.status(404).json({ error: 'Social account not found' });
    }

    // Verify ownership
    if (socialAccount.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden: You do not own this social account' });
    }

    // Check if already verified
    if (socialAccount.status === 'VERIFIED') {
      return res.status(200).json({
        message: 'Social account is already verified',
        socialAccount: {
          id: socialAccount.id,
          status: socialAccount.status,
          verifiedAt: socialAccount.verifiedAt,
        },
      });
    }

    // Check if verification code has expired
    if (socialAccount.verificationExpiresAt && socialAccount.verificationExpiresAt < new Date()) {
      return res.status(400).json({
        error: 'Verification code has expired. Please create a new social account.',
      });
    }

    if (!socialAccount.verificationCode) {
      return res.status(400).json({ error: 'No verification code found' });
    }

    // Verify using appropriate collector based on platform
    try {
      let verificationResult;
      let platformName: string;
      let location: string;

      if (socialAccount.platform === 'YOUTUBE') {
        platformName = 'YouTube';
        location = 'channel description';
        verificationResult = await getYouTubeCollector().verifyChannelDescriptionContainsCode(
          socialAccount.handle,
          socialAccount.verificationCode
        );
      } else if (socialAccount.platform === 'TIKTOK') {
        platformName = 'TikTok';
        location = 'bio';
        verificationResult = await getTikTokCollector().verifyUserBioContainsCode(
          socialAccount.handle,
          socialAccount.verificationCode
        );
      } else if (socialAccount.platform === 'INSTAGRAM') {
        platformName = 'Instagram';
        location = 'bio';
        verificationResult = await getInstagramCollector().verifyUserBioContainsCode(
          socialAccount.handle,
          socialAccount.verificationCode
        );
      } else {
        return res.status(400).json({
          error: 'Unsupported platform',
          message: `Platform "${socialAccount.platform}" is not supported for verification.`,
        });
      }

      if (verificationResult.ok) {
        // Update social account with verified information
        // Normalize userId to string to ensure consistent format
        const platformUserId = String(verificationResult.userId || verificationResult.channelId || '');
        
        console.log(`[Social Account Verify] Setting platformUserId to: ${platformUserId} for ${socialAccount.platform} account ${id}`);
        
        const updated = await prisma.socialAccount.update({
          where: { id },
          data: {
            platformUserId,
            profileUrl: verificationResult.profileUrl,
            verifiedAt: new Date(),
            status: 'VERIFIED',
          },
        });

        return res.status(200).json({
          message: 'Social account verified successfully',
          socialAccount: {
            id: updated.id,
            status: updated.status,
            platformUserId: updated.platformUserId,
            profileUrl: updated.profileUrl,
            verifiedAt: updated.verifiedAt,
          },
        });
      } else {
        // Verification failed - code not found
        return res.status(400).json({
          error: 'Verification failed',
          message: `The verification code "${socialAccount.verificationCode}" was not found in your ${platformName} ${location}. Please make sure you've added it exactly as shown and try again.`,
          socialAccount: {
            id: socialAccount.id,
            status: socialAccount.status,
            handle: socialAccount.handle,
          },
        });
      }
    } catch (error) {
      // Handle API errors
      if (error instanceof Error) {
        return res.status(400).json({
          error: 'Verification failed',
          message: `Failed to verify account: ${error.message}. Please check that your handle is correct and try again.`,
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error verifying social account:', error);
    
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
        error: 'Failed to verify social account',
        message: error.message
      });
    }
    
    res.status(500).json({ error: 'Failed to verify social account' });
  }
});

/**
 * GET /social-accounts
 * List all social accounts for the current user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const accounts = await prisma.socialAccount.findMany({
      where: {
        userId,
      },
      select: {
        id: true,
        platform: true,
        handle: true,
        status: true,
        platformUserId: true,
        verifiedAt: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({ accounts });
  } catch (error) {
    console.error('Error fetching social accounts:', error);
    res.status(500).json({ 
      error: 'Failed to fetch social accounts',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

