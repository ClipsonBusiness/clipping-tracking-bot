import { Request, Response, NextFunction } from 'express';

/**
 * Basic auth middleware placeholder
 * In production, this would validate JWT tokens, session cookies, etc.
 * For now, it assumes the user exists and sets req.user
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
  // TODO: Implement actual authentication
  // For now, this is a placeholder that assumes user exists
  // In production, extract user from JWT token, session, etc.
  
  // Placeholder: Assume user ID from header or default to a test user
  // In real implementation, validate token and fetch user from database
  const userId = req.headers['x-user-id'] as string || 'default-user-id';
  const userRole = (req.headers['x-user-role'] as 'CLIPPER' | 'ADMIN') || 'CLIPPER';

  req.user = {
    id: userId,
    role: userRole,
  };

  next();
};

