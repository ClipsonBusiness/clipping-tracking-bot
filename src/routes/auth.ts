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

    // Check which columns exist in the User table
    let usernameColumnExists: boolean = false;
    let passwordColumnExists: boolean = false;
    try {
      const columns = await prisma.$queryRaw<Array<{column_name: string}>>`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'User' 
        AND column_name IN ('username', 'password')
      `;
      usernameColumnExists = columns.some(c => c.column_name === 'username');
      passwordColumnExists = columns.some(c => c.column_name === 'password');
      console.log('Username column exists:', usernameColumnExists);
      console.log('Password column exists:', passwordColumnExists);
    } catch (checkError: any) {
      console.warn('Could not check columns, assuming they do not exist:', checkError.message);
      usernameColumnExists = false;
      passwordColumnExists = false;
    }

    // Check if user already exists by email
    let existingEmail;
    if (usernameColumnExists) {
      existingEmail = await prisma.user.findUnique({
        where: { email: trimmedEmail },
      });
    } else {
      // Use raw SQL if username column doesn't exist
      const result = await prisma.$queryRaw<Array<{id: string; email: string}>>`
        SELECT id, email FROM "User" WHERE email = ${trimmedEmail} LIMIT 1
      `;
      existingEmail = result[0] || null;
    }

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

    // Create user - use raw SQL if username column doesn't exist to avoid Prisma issues
    let user: { id: string; email: string; role: string; username?: string | null; createdAt: Date } | null = null;
    
    if (!usernameColumnExists || !passwordColumnExists) {
      // Use raw SQL to create user, only including columns that exist
      try {
        // Generate a CUID-like ID
        const userId = `cuid_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        
        // Build INSERT query based on which columns exist
        if (passwordColumnExists && usernameColumnExists && trimmedUsername) {
          await prisma.$executeRaw`
            INSERT INTO "User" (id, email, password, username, role, "createdAt")
            VALUES (${userId}, ${trimmedEmail}, ${hashedPassword}, ${trimmedUsername}, ${validRole}, NOW())
          `;
        } else if (passwordColumnExists) {
          await prisma.$executeRaw`
            INSERT INTO "User" (id, email, password, role, "createdAt")
            VALUES (${userId}, ${trimmedEmail}, ${hashedPassword}, ${validRole}, NOW())
          `;
        } else if (usernameColumnExists && trimmedUsername) {
          await prisma.$executeRaw`
            INSERT INTO "User" (id, email, username, role, "createdAt")
            VALUES (${userId}, ${trimmedEmail}, ${trimmedUsername}, ${validRole}, NOW())
          `;
        } else {
          // Neither password nor username columns exist
          await prisma.$executeRaw`
            INSERT INTO "User" (id, email, role, "createdAt")
            VALUES (${userId}, ${trimmedEmail}, ${validRole}, NOW())
          `;
        }
        
        // Fetch user using raw SQL - only select columns that exist
        let selectColumns = 'id, email, role, "createdAt"';
        if (usernameColumnExists) {
          selectColumns += ', username';
        }
        
        const fetchResult = await prisma.$queryRawUnsafe<Array<{id: string; email: string; role: string; username?: string | null; createdAt: string}>>(
          `SELECT ${selectColumns} FROM "User" WHERE id = $1`,
          userId
        );
        
        if (fetchResult[0]) {
          user = {
            id: fetchResult[0].id,
            email: fetchResult[0].email,
            role: fetchResult[0].role,
            createdAt: new Date(fetchResult[0].createdAt),
            username: fetchResult[0].username || null,
          };
        } else {
          throw new Error('Failed to fetch created user');
        }
      } catch (sqlError: any) {
        console.error('Raw SQL user creation failed:', sqlError);
        throw sqlError;
      }
    } else {
      // Username column exists, use Prisma normally
      try {
        // Build user data object
        const userData: any = {
          email: trimmedEmail,
          password: hashedPassword,
          role: validRole,
        };
        
        // Add username if provided
        if (trimmedUsername && trimmedUsername.length > 0) {
          if (trimmedUsername.length > 255) {
            return res.status(400).json({ error: 'Username is too long (max 255 characters)' });
          }
          userData.username = trimmedUsername;
        }
        
        // Create user
        const createdUser = await prisma.user.create({
          data: userData,
        });
        
        // Fetch user with selected fields
        user = await prisma.user.findUnique({
          where: { id: createdUser.id },
          select: {
            id: true,
            email: true,
            role: true,
            createdAt: true,
            username: true,
          },
        });
        
        if (!user) {
          throw new Error('Failed to fetch created user');
        }
      } catch (createError: any) {
        console.error('Prisma user creation failed:', createError);
        throw createError;
      }
    }

    // Ensure user was created
    if (!user) {
      throw new Error('Failed to create user');
    }

    // TypeScript guard: user is definitely not null here (narrowed by the check above)
    const finalUser: { id: string; email: string; role: string; username?: string | null; createdAt: Date } = user;

    // Create session
    const token = generateToken();
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
    sessions.set(token, { userId: finalUser.id, role: finalUser.role, expiresAt });

    res.status(201).json({
      user: finalUser,
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

    // Check which columns exist in the User table
    let usernameColumnExists: boolean = false;
    let passwordColumnExists: boolean = false;
    try {
      const columns = await prisma.$queryRaw<Array<{column_name: string}>>`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'User' 
        AND column_name IN ('username', 'password')
      `;
      usernameColumnExists = columns.some(c => c.column_name === 'username');
      passwordColumnExists = columns.some(c => c.column_name === 'password');
    } catch (checkError: any) {
      usernameColumnExists = false;
      passwordColumnExists = false;
    }

    // Find user by email or username
    let user: any = null;
    if (email) {
      if (usernameColumnExists && passwordColumnExists) {
        // Both columns exist, use Prisma normally
        user = await prisma.user.findUnique({
          where: { email },
        });
      } else {
        // Use raw SQL if columns don't exist - only select columns that exist
        let selectCols = 'id, email, role, "createdAt"';
        if (passwordColumnExists) selectCols += ', password';
        if (usernameColumnExists) selectCols += ', username';
        
        const result = await prisma.$queryRawUnsafe<Array<{id: string; email: string; role: string; password?: string | null; username?: string | null; createdAt: string}>>(
          `SELECT ${selectCols} FROM "User" WHERE email = $1 LIMIT 1`,
          email
        );
        if (result[0]) {
          user = {
            id: result[0].id,
            email: result[0].email,
            role: result[0].role,
            password: result[0].password || null,
            createdAt: new Date(result[0].createdAt),
            username: result[0].username || null,
          };
        }
      }
    } else if (username && usernameColumnExists) {
      // Only try username lookup if column exists
      try {
        user = await prisma.user.findFirst({
          where: { username },
        });
      } catch (usernameError: any) {
        if (usernameError.message?.includes('username') && usernameError.message?.includes('does not exist')) {
          return res.status(401).json({ error: 'User not found' });
        }
        throw usernameError;
      }
    } else if (username && !usernameColumnExists) {
      // Username column doesn't exist, can't search by username
      return res.status(401).json({ error: 'User not found' });
    }

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // For testing: if no password provided, allow login anyway
    // If password provided, validate it
    if (password) {
      // Check password (already fetched in raw SQL or need to fetch)
      let userPassword = user.password;
      if (!userPassword && usernameColumnExists) {
        const userWithPassword = await prisma.user.findUnique({
          where: { id: user.id },
          select: { password: true },
        });
        userPassword = userWithPassword?.password || null;
      }
      
      if (userPassword) {
        const hashedPassword = hashPassword(password);
        if (userPassword !== hashedPassword) {
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

