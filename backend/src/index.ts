import { config } from 'dotenv';
config({ path: '.env.local' });
config(); // Load .env as fallback

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { authMiddleware } from './middleware/auth';
import auth from './routes/auth';
import calendar from './routes/calendar';
import history from './routes/history';
import menu from './routes/menu';
import order from './routes/order';
import ai from './routes/ai';
import settings from './routes/settings';

const app = new Hono();

// ============================================================================
// Middleware
// ============================================================================

// Logger
app.use('*', logger());

// CORS - Allow frontend requests
app.use('*', cors());

// Auth middleware for API routes (except auth routes)
app.use('/api/*', authMiddleware);

// ============================================================================
// Routes
// ============================================================================

// Health check
app.get('/health', (c) => {
  return c.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Root route
app.get('/', (c) => {
  return c.json({
    name: 'Meican API Proxy',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      login: '/api/auth/login',
      logout: '/api/auth/logout',
      authStatus: '/api/auth/status',
      calendarList: '/api/calendarItems/list',
      addresses: '/api/corpaddresses/getmulticorpaddress',
      restaurants: '/api/restaurants/list',
      dishes: '/api/recommendations/dishes',
      addOrder: '/api/orders/add',
      deleteOrder: '/api/orders/delete',
      historyOrders: '/api/history/orders',
      aiChat: '/api/ai/chat',
    }
  });
});

// Mount route modules
app.route('/api/auth', auth);
app.route('/api/calendarItems', calendar);
app.route('/api/history', history);
app.route('/api', menu);
app.route('/api/orders', order);
app.route('/api/ai', ai);
app.route('/api/settings', settings);

// ============================================================================
// Server
// ============================================================================

const port = parseInt(process.env.PORT || '8080', 10);

console.log(`
╔══════════════════════════════════════════════════════════════╗
║                   Meican API Proxy Server                    ║
║══════════════════════════════════════════════════════════════║
║  Status: Running                                             ║
║  Port: ${port.toString().padEnd(54)}║
║  Time: ${new Date().toISOString().padEnd(53)}║
╚══════════════════════════════════════════════════════════════╝
`);

// Check if running in Bun to avoid double server start (Bun auto-starts on default export)
if (!process.versions['bun']) {
  serve({
    fetch: app.fetch,
    port,
  });
}

export default app;
