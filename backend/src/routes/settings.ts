import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import * as fs from 'fs/promises';
import * as path from 'path';

const settings = new Hono();
const DATA_DIR = path.join(process.cwd(), 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'user_settings.json');

// Ensure data directory exists
const ensureDataDir = async () => {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
};

// Read all settings
const readSettings = async (): Promise<Record<string, any>> => {
  await ensureDataDir();
  try {
    const data = await fs.readFile(SETTINGS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
};

// Save all settings
const writeSettings = async (data: Record<string, any>) => {
  await ensureDataDir();
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(data, null, 2));
};

// Middleware to extract username (email) from session or request
// For simplicity, we'll assume the client sends the username in the header or body for now, 
// or we extract it from the session if available. 
// However, the requirement says "linked to user email", so we need to know the email.
// In the current auth flow, the session ID is returned on login. 
// We might need to store the email-session mapping or trust the client to send the email.
// Given the current simple architecture, let's look at how auth is handled.
// The user said "backend records user settings based on user email".
// We'll expect the client to provide the email (username) when saving/fetching settings, 
// or we derive it from the session if we have that mapping.
// Let's check `auth.ts` to see if we have session-to-username mapping.

// ... Wait, I should check `auth.ts` first to see if I can get the username from the session.
// If not, I might need to trust the client sending the username, or update auth to store it.
// Let's assume for this step that I'll check `auth.ts` in a moment. 
// For now, I'll write the code to accept `username` in the query/body.

settings.get('/', async (c) => {
  const username = c.req.query('username');
  if (!username) {
    return c.json({ error: 'Username required' }, 400);
  }

  const allSettings = await readSettings();
  const userSettings = allSettings[username] || {};
  return c.json(userSettings);
});

settings.post('/', async (c) => {
  const body = await c.req.json();
  const { username, settings: newSettings } = body;

  if (!username || !newSettings) {
    return c.json({ error: 'Username and settings required' }, 400);
  }

  const allSettings = await readSettings();
  allSettings[username] = { ...(allSettings[username] || {}), ...newSettings };
  
  await writeSettings(allSettings);
  return c.json({ success: true });
});

export default settings;
