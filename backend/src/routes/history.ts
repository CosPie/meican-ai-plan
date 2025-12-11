import { Hono } from 'hono';
import { MeicanService } from '../services/meican';

const history = new Hono();

interface CalendarItem {
  title: string;
  targetTime: number;
  status: 'CLOSED' | 'ORDER' | 'AVAILABLE';
  userTab: {
    uniqueId: string;
    name: string;
  };
  openingTime: {
    name: string;
  };
  corpOrderUser: {
    uniqueId: string;
    restaurantItemList: {
      uniqueId: string;
      restaurant?: {
        name: string;
      };
      dishItemList: {
        dish: {
          id: number;
          name: string;
          priceInCent: number;
        };
        count: number;
      }[];
    }[];
  } | null;
}

interface CalendarDate {
  date: string;
  calendarItemList: CalendarItem[];
}

interface CalendarResponse {
  dateList: CalendarDate[];
}

interface HistoricalOrder {
  date: string;
  mealTime: 'BREAKFAST' | 'LUNCH' | 'DINNER';
  dishName: string;
  restaurantName: string;
  priceInCent: number;
}

/**
 * GET /api/history/orders
 * Fetch historical orders for analysis
 * 
 * Query params:
 * - beginDate: YYYY-MM-DD (optional, defaults to 90 days ago)
 * - endDate: YYYY-MM-DD (optional, defaults to today)
 */
history.get('/orders', async (c) => {
  const auth = c.get('auth');
  
  // Default to last 30 days, fetch in 15-day chunks to avoid API limits
  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);
  
  const requestedBeginDate = c.req.query('beginDate') || thirtyDaysAgo.toISOString().split('T')[0];
  const requestedEndDate = c.req.query('endDate') || today.toISOString().split('T')[0];

  try {
    const allOrders: HistoricalOrder[] = [];
    
    // Fetch in 15-day chunks to avoid "Period is out of range" error
    const startDate = new Date(requestedBeginDate);
    const endDate = new Date(requestedEndDate);
    const chunkDays = 15;
    
    let currentStart = new Date(startDate);
    
    while (currentStart < endDate) {
      const currentEnd = new Date(currentStart);
      currentEnd.setDate(currentEnd.getDate() + chunkDays - 1);
      
      // Don't exceed the requested end date
      if (currentEnd > endDate) {
        currentEnd.setTime(endDate.getTime());
      }
      
      const beginDateStr = currentStart.toISOString().split('T')[0];
      const endDateStr = currentEnd.toISOString().split('T')[0];
      
      console.log(`[History] Fetching chunk: ${beginDateStr} to ${endDateStr}`);
      
      const data = await MeicanService.getCalendarItems(
        beginDateStr,
        endDateStr,
        auth,
        true // withOrderDetail
      ) as CalendarResponse;

      // Transform response to HistoricalOrder[]
      for (const dateItem of data.dateList || []) {
        for (const calItem of dateItem.calendarItemList || []) {
          // Only process items with ORDER status (completed orders)
          if (calItem.status !== 'ORDER' || !calItem.corpOrderUser) {
            continue;
          }

          // Determine meal time
          const titleLower = (calItem.title || '').toLowerCase();
          const openingName = (calItem.openingTime?.name || '').toLowerCase();
          
          let mealTime: 'BREAKFAST' | 'LUNCH' | 'DINNER';
          if (titleLower.includes('早餐') || openingName.includes('早餐') || titleLower.includes('breakfast')) {
            mealTime = 'BREAKFAST';
          } else if (titleLower.includes('午餐') || openingName.includes('午餐') || titleLower.includes('lunch')) {
            mealTime = 'LUNCH';
          } else {
            mealTime = 'DINNER';
          }

          // Extract dishes from the order
          for (const restaurantItem of calItem.corpOrderUser.restaurantItemList || []) {
            const restaurantName = restaurantItem.restaurant?.name || 'Unknown Restaurant';
            
            for (const dishItem of restaurantItem.dishItemList || []) {
              allOrders.push({
                date: dateItem.date,
                mealTime,
                dishName: dishItem.dish.name,
                restaurantName,
                priceInCent: dishItem.dish.priceInCent,
              });
            }
          }
        }
      }
      
      // Move to next chunk
      currentStart.setDate(currentStart.getDate() + chunkDays);
    }

    console.log(`[History] Total orders fetched: ${allOrders.length}`);
    return c.json({ orders: allOrders });
  } catch (error) {
    console.error('[History] Error:', error);
    return c.json({ 
      error: 'Failed to fetch order history',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default history;
