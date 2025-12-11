import { Hono } from 'hono';
import { MeicanService } from '../services/meican';

const menu = new Hono();

/**
 * GET /api/corpaddresses/getmulticorpaddress
 * Get user's available delivery addresses
 * 
 * Query params:
 * - namespace: string (optional)
 */
menu.get('/corpaddresses/getmulticorpaddress', async (c) => {
  const auth = c.get('auth');
  const namespace = c.req.query('namespace') || '';

  try {
    const data = await MeicanService.getAddresses(namespace, auth);
    return c.json(data);
  } catch (error) {
    console.error('[Menu] Error fetching addresses:', error);
    return c.json({ 
      error: 'Failed to fetch addresses',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /api/restaurants/list
 * Get available restaurants for a meal slot
 * 
 * Query params:
 * - tabUniqueId: string (required)
 * - targetTime: YYYY-MM-DD HH:mm (required)
 */
menu.get('/restaurants/list', async (c) => {
  const auth = c.get('auth');
  const tabUniqueId = c.req.query('tabUniqueId');
  const targetTime = c.req.query('targetTime');

  if (!tabUniqueId || !targetTime) {
    return c.json({ error: 'tabUniqueId and targetTime are required' }, 400);
  }

  try {
    const data = await MeicanService.getRestaurants(tabUniqueId, targetTime, auth);
    return c.json(data);
  } catch (error) {
    console.error('[Menu] Error fetching restaurants:', error);
    return c.json({ 
      error: 'Failed to fetch restaurants',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /api/recommendations/dishes
 * Get available dishes for a meal slot
 * 
 * Query params:
 * - tabUniqueId: string (required)
 * - targetTime: YYYY-MM-DD HH:mm (required)
 */
menu.get('/recommendations/dishes', async (c) => {
  const auth = c.get('auth');
  const tabUniqueId = c.req.query('tabUniqueId');
  const targetTime = c.req.query('targetTime');

  if (!tabUniqueId || !targetTime) {
    return c.json({ error: 'tabUniqueId and targetTime are required' }, 400);
  }

  try {
    const data = await MeicanService.getDishes(tabUniqueId, targetTime, auth);
    return c.json(data);
  } catch (error) {
    console.error('[Menu] Error fetching dishes:', error);
    return c.json({ 
      error: 'Failed to fetch dishes',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default menu;
