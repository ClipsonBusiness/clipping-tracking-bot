import { Request, Response, NextFunction } from 'express';
import { authMiddleware } from './auth';

/**
 * Admin-only middleware
 * Requires user to be authenticated and have ADMIN role
 * Should be used after authMiddleware
 */
export const adminMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // First ensure user is authenticated
  if (!req.user) {
    // If user is not set, try to authenticate first
    return authMiddleware(req, res, () => {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
      }

      next();
    });
  }

  // User is already authenticated, just check role
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }

  next();
};

