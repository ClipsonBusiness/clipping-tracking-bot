import { Router, Request, Response } from 'express';
import { getPrismaClient } from '../utils/prisma';
import crypto from 'crypto';

const router = Router();

// Simple password hashing (use bcrypt in production)
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Simple session token generation
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Store sessions in memory (use Redis in production)
const sessions = new Map<string, { userId: string; role: string; expiresAt: number }>();

// Clean up expired sessions every hour
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt < now) {
      sessions.delete(token);
    }
  }
}, 3600000); // 1 hour

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    console.log('Registration request body:', JSON.stringify(req.body));
    const { email, username, password, role = 'CLIPPER' } = req.body;

    // Validate email
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required and must be a string' });
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      return res.status(400).json({ error: 'Email cannot be empty' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate username if provided (optional for testing/backwards compatibility)
    let trimmedUsername: string | null = null;
    if (username && typeof username === 'string') {
      trimmedUsername = username.trim();
      if (trimmedUsername.length > 0) {
        // Validate username format (alphanumeric, underscore, hyphen, 3-20 chars)
        const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
        if (!usernameRegex.test(trimmedUsername)) {
          return res.status(400).json({ error: 'Username must be 3-20 characters (letters, numbers, _, -)' });
        }
      } else {
        trimmedUsername = null;
      }
    }

    // Password is optional for testing
    const hashedPassword = (password && typeof password === 'string' && password.length > 0) 
      ? hashPassword(password) 
      : null;

    // Validate role
    const validRole = (role === 'CLIPPER' || role === 'ADMIN') ? role : 'CLIPPER';

    const prisma = getPrismaClient();

    // First, check if username column exists by trying a safe query
    let usernameColumnExists = false;
    try {
      const result = await prisma.$queryRaw<Array<{column_name: string}>>`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'username'
      `;
      usernameColumnExists = result.length > 0;
      console.log('Username column exists:', usernameColumnExists);
    } catch (checkError: any) {
      console.warn('Could not check username column, assuming it does not exist:', checkError.message);
      usernameColumnExists = false;
    }

    // Check if user already exists by email
    const existingEmail = await prisma.user.findUnique({
      where: { email: trimmedEmail },
    });

    if (existingEmail) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Check username uniqueness ONLY if column exists
    if (usernameColumnExists && trimmedUsername && trimmedUsername.length > 0) {
      try {
        const existingUsername = await prisma.user.findFirst({
          where: { username: trimmedUsername },
        });

        if (existingUsername) {
          return res.status(409).json({ error: 'Username already taken' });
        }
      } catch (usernameError: any) {
        // If this fails, username column might not actually exist
        console.warn('Username uniqueness check failed, skipping:', usernameError.message);
        usernameColumnExists = false;
      }
    }

    // Create user
    let user: any = null;
    try {
      // Build user data object
      const userData: any = {
        email: trimmedEmail,
        password: hashedPassword,
        role: validRole,
      };
      
      // Only add username if column exists and username is valid
      if (usernameColumnExists && trimmedUsername && trimmedUsername.length > 0) {
        // Validate username length
        if (trimmedUsername.length > 255) {
          return res.status(400).json({ error: 'Username is too long (max 255 characters)' });
        }
        userData.username = trimmedUsername;
      }
      // If usernameColumnExists is false, we simply don't add username to userData
      
      // Create user - if username column doesn't exist, it will be ignored
      const createdUser = await prisma.user.create({
        data: userData,
      });
      
      // Fetch user - only select fields that definitely exist
      const userId = createdUser.id;
      try {
        user = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            role: true,
            createdAt: true,
            ...(usernameColumnExists ? { username: true } : {}),
          },
        });
      } catch (fetchError: any) {
        // If fetch fails due to username, try without it
        if (fetchError.message?.includes('username')) {
          user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
              id: true,
              email: true,
              role: true,
              createdAt: true,
            },
          });
        } else {
          throw fetchError;
        }
      }
      
      // Add username to response (for frontend compatibility)
      if (!user) {
        throw new Error('Failed to fetch created user');
      }
      (user as any).username = (usernameColumnExists && trimmedUsername) ? trimmedUsername : null;
    } catch (createError: any) {
      // If username column doesn't exist yet (migration not run), try without it
      if (createError.code === 'P2011' || 
          createError.message?.includes('Unknown column') || 
          (createError.message?.includes('username') && createError.message?.includes('does not exist')) ||
          (createError.message?.includes('column') && createError.message?.includes('username'))) {
        console.warn('Username column does not exist, creating user without username');
        try {
          // Remove username from userData
          const userDataWithoutUsername: any = {
            email: trimmedEmail,
            password: hashedPassword,
            role: validRole,
          };
          
          const createdUserWithoutUsername = await prisma.user.create({
            data: userDataWithoutUsername,
          });
          
          // Fetch user without username field
          user = await prisma.user.findUnique({
            where: { id: createdUserWithoutUsername.id },
            select: {
              id: true,
              email: true,
              role: true,
              createdAt: true,
            },
          });
          
          // Add username to response manually (for frontend)
          if (!user) {
            throw new Error('Failed to fetch created user');
          }
          (user as any).username = null; // Column doesn't exist, so username is null
        } catch (fallbackError: any) {
          console.error('Fallback user creation also failed:', fallbackError);
          throw fallbackError;
        }
      } else {
        throw createError;
      }
    }

    // Ensure user was created
    if (!user) {
      throw new Error('Failed to create user');
    }

    // Create session
    const token = generateToken();
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
    sessions.set(token, { userId: user.id, role: user.role, expiresAt });

    res.status(201).json({
      user,
      token,
      message: 'User registered successfully',
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    
    // Provide more specific error messages
    if (error.code === 'P2002') {
      // Unique constraint violation
      const target = error.meta?.target || [];
      if (Array.isArray(target) && target.includes('email')) {
        return res.status(409).json({ error: 'User with this email already exists' });
      }
      if (Array.isArray(target) && target.includes('username')) {
        return res.status(409).json({ error: 'Username already taken' });
      }
      if (typeof target === 'string' && target.includes('email')) {
        return res.status(409).json({ error: 'User with this email already exists' });
      }
      if (typeof target === 'string' && target.includes('username')) {
        return res.status(409).json({ error: 'Username already taken' });
      }
      return res.status(409).json({ error: 'User already exists', details: error.meta });
    }
    
    if (error.code === 'P2011') {
      // Null constraint violation (username might not exist in DB yet)
      return res.status(500).json({ 
        error: 'Database schema error',
        message: 'Username field may not exist in database. Please run migrations.',
        details: error.message
      });
    }
    
    if (error.code === 'P2022') {
      // Value out of range for the type
      const field = error.meta?.column_name || error.meta?.target || 'unknown field';
      return res.status(400).json({ 
        error: 'Invalid input value',
        message: `The value for ${field} is out of range or too long. Please check your input.`,
        details: error.message,
        meta: error.meta,
        hint: 'Username must be 3-20 characters, email must be valid format'
      });
    }
    
    res.status(500).json({
      error: 'Failed to register user',
      message: error.message || 'Unknown error',
      details: error.code ? `Error code: ${error.code}` : undefined,
      meta: error.meta,
    });
  }
});

/**
 * POST /api/auth/login
 * Login with email/username and password (password optional for testing)
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, username, password } = req.body;

    // Allow login with either email or username
    if (!email && !username) {
      return res.status(400).json({ error: 'Email or username is required' });
    }

    const prisma = getPrismaClient();

    // Find user by email or username
    let user = null;
    if (email) {
      user = await prisma.user.findUnique({
        where: { email },
      });
    } else if (username) {
      user = await prisma.user.findFirst({
        where: { username },
      });
    }

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // For testing: if no password provided, allow login anyway
    // If password provided, validate it
    if (password) {
      // Fetch user with password field to check
      const userWithPassword = await prisma.user.findUnique({
        where: { id: user.id },
        select: { password: true },
      });
      
      if (userWithPassword?.password) {
        const hashedPassword = hashPassword(password);
        if (userWithPassword.password !== hashedPassword) {
          return res.status(401).json({ error: 'Invalid password' });
        }
      }
    }

    // Create session
    const token = generateToken();
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
    sessions.set(token, { userId: user.id, role: user.role, expiresAt });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username || null,
        role: user.role,
      },
      token,
      message: 'Login successful',
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Failed to login',
      message: error.message,
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout (clear session)
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      sessions.delete(token);
    }
    res.json({ message: 'Logged out successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to logout' });
  }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const session = sessions.get(token);
    if (!session || session.expiresAt < Date.now()) {
      return res.status(401).json({ error: 'Session expired' });
    }

    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// Export sessions map for use in auth middleware
export { sessions };

export default router;

