import { Context, Next } from 'hono';
import { getSessionCookies } from '../routes/auth';

// Environment variables for default credentials
const DEFAULT_CLIENT_ID = process.env.MEICAN_CLIENT_ID || 'meican_client';
const DEFAULT_CLIENT_SECRET = process.env.MEICAN_CLIENT_SECRET || 'meican_secret';

export interface AuthContext {
  cookie: string;
  accessToken?: string;
  clientId: string;
  clientSecret: string;
  sessionId?: string;
}

declare module 'hono' {
  interface ContextVariableMap {
    auth: AuthContext;
  }
}

/**
 * Authentication middleware
 * Extracts authentication credentials from request headers
 * Supports both direct cookie/token and session-based auth
 */
export const authMiddleware = async (c: Context, next: Next) => {
  // Check for session-based auth first
  const sessionId = c.req.header('X-Session-Id');
  let cookie = '';

  if (sessionId) {
    // Get cookies from session storage
    const sessionCookies = getSessionCookies(sessionId);
    if (sessionCookies) {
      cookie = sessionCookies;
    }
  }

  // Fall back to direct cookie header
  if (!cookie) {
    cookie = c.req.header('X-Meican-Cookie') || c.req.header('Cookie') || '';
  }

  const accessToken = c.req.header('Authorization')?.replace('Bearer ', '') || '';
  const clientId = c.req.header('X-Client-Id') || DEFAULT_CLIENT_ID;
  const clientSecret = c.req.header('X-Client-Secret') || DEFAULT_CLIENT_SECRET;

  c.set('auth', {
    cookie,
    accessToken,
    clientId,
    clientSecret,
    sessionId,
  });

  await next();
};
