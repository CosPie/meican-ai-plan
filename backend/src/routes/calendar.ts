import { Hono } from 'hono';
import { MeicanService } from '../services/meican';

const calendar = new Hono();

/**
 * GET /api/calendarItems/list
 * Query calendar items for a date range
 * 
 * Query params:
 * - beginDate: YYYY-MM-DD
 * - endDate: YYYY-MM-DD
 * - withOrderDetail: boolean (optional, default true)
 */
calendar.get('/list', async (c) => {
  const auth = c.get('auth');
  const beginDate = c.req.query('beginDate');
  const endDate = c.req.query('endDate');
  const withOrderDetail = c.req.query('withOrderDetail') !== 'false';

  if (!beginDate || !endDate) {
    return c.json({ error: 'beginDate and endDate are required' }, 400);
  }

  try {
    const data = await MeicanService.getCalendarItems(
      beginDate,
      endDate,
      auth,
      withOrderDetail
    );
    return c.json(data);
  } catch (error) {
    console.error('[Calendar] Error:', error);
    return c.json({ 
      error: 'Failed to fetch calendar items',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default calendar;
