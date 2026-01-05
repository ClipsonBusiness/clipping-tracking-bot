import { Request, Response, NextFunction } from 'express';
import { sessions } from '../routes/auth';

/**
 * Auth middleware that validates session tokens
 */
export interface AuthUser {
  id: string;
  role: 'CLIPPER' | 'ADMIN';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Try to get token from Authorization header or cookie
  const token = req.headers.authorization?.replace('Bearer ', '') || 
                req.cookies?.token ||
                req.headers['x-auth-token'] as string;

  // Fallback to header-based auth for backwards compatibility
  if (!token) {
    const userId = req.headers['x-user-id'] as string;
    const userRole = (req.headers['x-user-role'] as 'CLIPPER' | 'ADMIN');
    
    if (userId && userRole) {
      req.user = {
        id: userId,
        role: userRole,
      };
      return next();
    }
  }

  // Validate session token
  if (token) {
    const session = sessions.get(token);
    if (session && session.expiresAt > Date.now()) {
      req.user = {
        id: session.userId,
        role: session.role as 'CLIPPER' | 'ADMIN',
      };
      return next();
    }
  }

  // If no valid auth, return 401
  return res.status(401).json({ error: 'Unauthorized', message: 'Please login to continue' });
};

