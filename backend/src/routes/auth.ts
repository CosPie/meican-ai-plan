import { Hono } from 'hono';
import * as fs from 'fs';
import * as path from 'path';

const auth = new Hono();

const MEICAN_BASE_URL = 'https://meican.com';

// File-based session storage for persistence across restarts
const SESSIONS_FILE = path.join(process.cwd(), 'data', '.sessions.json');

interface SessionData {
  cookies: string;
  createdAt: string;
}

interface SessionsStore {
  [sessionId: string]: SessionData;
}

// Load sessions from file on startup
function loadSessions(): Map<string, { cookies: string; createdAt: Date }> {
  const map = new Map<string, { cookies: string; createdAt: Date }>();
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const data = fs.readFileSync(SESSIONS_FILE, 'utf-8');
      const stored: SessionsStore = JSON.parse(data);
      for (const [sessionId, session] of Object.entries(stored)) {
        map.set(sessionId, {
          cookies: session.cookies,
          createdAt: new Date(session.createdAt),
        });
      }
      console.log(`[Auth] Loaded ${map.size} sessions from file`);
    }
  } catch (error) {
    console.warn('[Auth] Failed to load sessions file:', error);
  }
  return map;
}

// Save sessions to file
function saveSessions(sessions: Map<string, { cookies: string; createdAt: Date }>): void {
  try {
    const stored: SessionsStore = {};
    for (const [sessionId, session] of sessions.entries()) {
      stored[sessionId] = {
        cookies: session.cookies,
        createdAt: session.createdAt.toISOString(),
      };
    }
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(stored, null, 2));
    console.log(`[Auth] Saved ${sessions.size} sessions to file`);
  } catch (error) {
    console.error('[Auth] Failed to save sessions file:', error);
  }
}

// Initialize sessions from persistent storage
const sessions = loadSessions();

/**
 * Generate a session ID
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Extract cookies from response headers
 */
function extractCookies(response: Response): string {
  const setCookieHeaders = response.headers.getSetCookie?.() || [];
  const cookies = setCookieHeaders.map(cookie => {
    // Extract just the cookie name=value part
    return cookie.split(';')[0];
  });
  return cookies.join('; ');
}

/**
 * POST /api/auth/login
 * Login with username and password
 * 
 * Body (JSON):
 * - username: string
 * - password: string
 */
auth.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    const { username, password } = body;

    if (!username || !password) {
      return c.json({ error: 'Username and password are required' }, 400);
    }

    console.log(`[Auth] Attempting login for user: ${username}`);

    // Prepare form data for login
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    formData.append('loginType', 'username');
    formData.append('remember', 'true');

    // Make login request to Meican
    const loginUrl = `${MEICAN_BASE_URL}/account/directlogin`;
    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Origin': 'https://meican.com',
        'Referer': 'https://meican.com/',
      },
      body: formData.toString(),
      redirect: 'manual', // Don't follow redirects to capture cookies
    });

    console.log(`[Auth] Login response status: ${response.status}`);

    // Check if login was successful
    // Meican returns 200 on success, may also return redirect
    const responseText = await response.text();
    
    if (responseText.includes('用户名或密码错误') || responseText.includes('login fail')) {
      console.log('[Auth] Login failed: invalid credentials');
      return c.json({ 
        success: false, 
        error: 'Invalid username or password' 
      }, 401);
    }

    // Extract cookies from response
    const cookies = extractCookies(response);
    
    if (!cookies) {
      console.log('[Auth] Login failed: no cookies received');
      return c.json({ 
        success: false, 
        error: 'Login failed - no session received' 
      }, 401);
    }

    // Validate cookies contain a valid session
    const hasPlaySession = cookies.includes('PLAY_SESSION=') && !cookies.includes('PLAY_SESSION=;');
    const hasError = cookies.includes('error=') || cookies.includes('PLAY_ERRORS=') && !cookies.includes('PLAY_ERRORS=;');

    // Check for encoded error in PLAY_FLASH
    // Example: PLAY_FLASH="...&error=%E7%94%A8%E6%88%B7..."
    const flashMatch = cookies.match(/PLAY_FLASH="([^"]*)"/);
    if (flashMatch) {
      const flashContent = decodeURIComponent(flashMatch[1]);
      if (flashContent.includes('error=')) {
        console.log('[Auth] Login failed: error in flash cookie');
        return c.json({ 
          success: false, 
          error: 'Invalid username or password (Flash)' 
        }, 401);
      }
    }

    if (!hasPlaySession) {
      console.log('[Auth] Login failed: no valid PLAY_SESSION cookie');
      return c.json({ 
        success: false, 
        error: 'Login failed - invalid session' 
      }, 401);
    }

    // Generate session ID and store cookies
    const sessionId = generateSessionId();
    sessions.set(sessionId, {
      cookies,
      createdAt: new Date(),
    });
    
    // Persist sessions to file
    saveSessions(sessions);

    console.log(`[Auth] Login successful, session created: ${sessionId}`);

    return c.json({
      success: true,
      sessionId,
      message: 'Login successful',
    });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    return c.json({ 
      error: 'Login failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /api/auth/logout
 * Logout and clear session
 */
auth.post('/logout', async (c) => {
  const sessionId = c.req.header('X-Session-Id');
  
  if (sessionId && sessions.has(sessionId)) {
    sessions.delete(sessionId);
    saveSessions(sessions);
    console.log(`[Auth] Session logged out: ${sessionId}`);
  }

  return c.json({ success: true, message: 'Logged out' });
});

/**
 * GET /api/auth/status
 * Check if session is valid
 */
auth.get('/status', async (c) => {
  const sessionId = c.req.header('X-Session-Id');
  
  if (!sessionId || !sessions.has(sessionId)) {
    return c.json({ authenticated: false });
  }

  const session = sessions.get(sessionId)!;
  const ageMinutes = (Date.now() - session.createdAt.getTime()) / 1000 / 60;

  return c.json({ 
    authenticated: true,
    sessionAge: Math.round(ageMinutes),
  });
});

/**
 * Get session cookies for a session ID
 */
export function getSessionCookies(sessionId: string): string | null {
  const session = sessions.get(sessionId);
  return session?.cookies || null;
}

export default auth;
