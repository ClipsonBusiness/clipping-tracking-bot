import { Request, Response, NextFunction } from 'express';

// Import sessions map (lazy import to avoid circular dependency)
let sessions: Map<string, { userId: string; role: string; expiresAt: number }> | null = null;

function getSessions() {
  if (!sessions) {
    try {
      // Use require to get the actual sessions map instance
      const authModule = require('../routes/auth');
      sessions = authModule.sessions;
      
      // Verify we got the sessions map
      if (!sessions || !(sessions instanceof Map)) {
        console.warn('[Auth Middleware] Sessions map not found or invalid, creating new map');
        sessions = new Map();
      }
    } catch (e) {
      console.error('[Auth Middleware] Error loading sessions:', e);
      // If auth routes not loaded yet, create empty map
      sessions = new Map();
    }
  }
  return sessions;
}

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
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '') || 
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
    const sessionMap = getSessions();
    
    // Debug logging (always enabled for troubleshooting)
    console.log('[Auth Middleware] Token received:', token.substring(0, 20) + '...');
    console.log('[Auth Middleware] Session map size:', sessionMap?.size || 0);
    console.log('[Auth Middleware] Authorization header:', authHeader?.substring(0, 30) + '...');
    
    const session = sessionMap?.get(token);
    
    if (session) {
      console.log('[Auth Middleware] Session found:', { userId: session.userId, role: session.role, expiresAt: new Date(session.expiresAt).toISOString(), now: new Date().toISOString() });
      
      if (session.expiresAt > Date.now()) {
        req.user = {
          id: session.userId,
          role: session.role as 'CLIPPER' | 'ADMIN',
        };
        console.log('[Auth Middleware] Authentication successful');
        return next();
      } else {
        console.log('[Auth Middleware] Session expired. Expires:', new Date(session.expiresAt).toISOString(), 'Now:', new Date().toISOString());
      }
    } else {
      console.log('[Auth Middleware] Session not found for token');
      // Log all available tokens for debugging
      if (sessionMap && sessionMap.size > 0) {
        console.log('[Auth Middleware] Available tokens:', Array.from(sessionMap.keys()).map(t => t.substring(0, 20) + '...'));
      } else {
        console.log('[Auth Middleware] Session map is empty!');
      }
    }
  } else {
    console.log('[Auth Middleware] No token provided');
  }

  // If no valid auth, return 401
  return res.status(401).json({ error: 'Unauthorized', message: 'Please login to continue' });
};

