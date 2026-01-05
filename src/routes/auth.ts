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
    const { email, username, password, role = 'CLIPPER' } = req.body;

    if (!email || !username) {
      return res.status(400).json({ error: 'Email and username are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate username (alphanumeric, underscore, hyphen, 3-20 chars)
    const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({ error: 'Username must be 3-20 characters (letters, numbers, _, -)' });
    }

    // Password is optional for testing
    const hashedPassword = password ? hashPassword(password) : null;

    // Validate role
    if (role !== 'CLIPPER' && role !== 'ADMIN') {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const prisma = getPrismaClient();

    // Check if user already exists by email or username
    const existingEmail = await prisma.user.findUnique({
      where: { email },
    });

    if (existingEmail) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    const existingUsername = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUsername) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        role,
      },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        createdAt: true,
      },
    });

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
    res.status(500).json({
      error: 'Failed to register user',
      message: error.message,
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
      user = await prisma.user.findUnique({
        where: { username },
      });
    }

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // For testing: if no password provided, allow login anyway
    // If password provided, validate it
    if (password && user.password) {
      const hashedPassword = hashPassword(password);
      if (user.password !== hashedPassword) {
        return res.status(401).json({ error: 'Invalid password' });
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
        username: user.username,
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
        username: true,
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

