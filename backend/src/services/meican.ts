import type { AuthContext } from '../middleware/auth';

// Base URL for Meican preorder API (works with cookies-only auth)
const MEICAN_BASE_URL = 'https://meican.com/preorder/api/v2.1';

interface ProxyOptions {
  method?: 'GET' | 'POST';
  path: string;
  query?: Record<string, string>;
  body?: Record<string, string> | string;
  auth: AuthContext;
}

/**
 * Meican API Service
 * Handles all requests to the Meican API with proper authentication
 * Uses session cookies obtained from login for authentication
 */
export class MeicanService {
  /**
   * Make a proxied request to Meican API
   */
  static async proxyRequest<T>(options: ProxyOptions): Promise<T> {
    const { method = 'GET', path, query, body, auth } = options;

    // Build URL with query parameters
    const url = new URL(`${MEICAN_BASE_URL}${path}`);
    
    // Add anti-cache timestamp
    url.searchParams.set('noHttpGetCache', Date.now().toString());
    
    // Add additional query params
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    // Build headers - use session cookies for authentication
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Origin': 'https://meican.com',
      'Referer': 'https://meican.com/',
    };

    // Session cookies are the primary authentication method
    if (auth.cookie) {
      headers['Cookie'] = auth.cookie;
    } else {
      console.warn('[MeicanService] No session cookies available - request may fail');
    }

    // Handle body for POST requests
    let requestBody: string | undefined;
    if (method === 'POST' && body) {
      if (typeof body === 'string') {
        requestBody = body;
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
      } else {
        requestBody = new URLSearchParams(body).toString();
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
      }
    }

    console.log(`[MeicanService] ${method} ${url.pathname}${url.search}`);
    console.log(`[MeicanService] Cookies: ${auth.cookie ? 'present' : 'missing'}`);

    try {
      const response = await fetch(url.toString(), {
        method,
        headers,
        body: requestBody,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[MeicanService] Error ${response.status}: ${errorText.substring(0, 200)}`);
        throw new Error(`Meican API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      console.error('[MeicanService] Request failed:', error);
      throw error;
    }
  }

  /**
   * Get calendar items for date range
   */
  static async getCalendarItems(
    beginDate: string,
    endDate: string,
    auth: AuthContext,
    withOrderDetail: boolean = true
  ) {
    return this.proxyRequest({
      method: 'GET',
      path: '/calendarItems/list',
      query: {
        beginDate,
        endDate,
        withOrderDetail: withOrderDetail.toString(),
      },
      auth,
    });
  }

  /**
   * Get user addresses
   */
  static async getAddresses(namespace: string, auth: AuthContext) {
    return this.proxyRequest({
      method: 'GET',
      path: '/corpaddresses/getmulticorpaddress',
      query: { namespace },
      auth,
    });
  }

  /**
   * Get restaurant list
   */
  static async getRestaurants(
    tabUniqueId: string,
    targetTime: string,
    auth: AuthContext
  ) {
    return this.proxyRequest({
      method: 'GET',
      path: '/restaurants/list',
      query: {
        tabUniqueId,
        targetTime,
      },
      auth,
    });
  }

  /**
   * Get available dishes
   */
  static async getDishes(
    tabUniqueId: string,
    targetTime: string,
    auth: AuthContext
  ) {
    return this.proxyRequest({
      method: 'GET',
      path: '/recommendations/dishes',
      query: {
        tabUniqueId,
        targetTime,
      },
      auth,
    });
  }

  /**
   * Place an order
   */
  static async addOrder(
    orderData: Record<string, string>,
    auth: AuthContext
  ) {
    return this.proxyRequest({
      method: 'POST',
      path: '/orders/add',
      body: orderData,
      auth,
    });
  }

  /**
   * Delete an order
   */
  static async deleteOrder(
    uniqueId: string,
    type: string,
    restoreCart: string,
    auth: AuthContext
  ) {
    return this.proxyRequest({
      method: 'POST',
      path: '/orders/delete',
      body: {
        uniqueId,
        type,
        restoreCart,
      },
      auth,
    });
  }
}
