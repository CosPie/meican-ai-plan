import { DailyStatus, Dish, HistoricalOrder, MealTime, OrderStatus, UserPreferences } from '../types';
import { formatDate } from '../utils/dateUtils';

// ============================================================================
// Mock Data (for development/testing)
// ============================================================================

const MOCK_RESTAURANTS = ['Salad Green', 'Burger King', 'Niu Xiao Zao', 'Spicy Wok', 'Sushi Express'];
const MOCK_DISHES = [
  { name: 'Beef Salad with Avocado', price: 4500, tags: ['healthy', 'beef'] },
  { name: 'Double Cheeseburger', price: 3500, tags: ['fastfood', 'beef'] },
  { name: 'Spicy Tofu Rice', price: 2800, tags: ['spicy', 'vegetarian'] },
  { name: 'Salmon Sashimi Set', price: 6000, tags: ['seafood', 'healthy'] },
  { name: 'Braised Pork Rice', price: 3200, tags: ['pork', 'heavy'] },
];

const generateMockMenu = (restaurantName: string): Dish[] => {
  return MOCK_DISHES.map((d, i) => ({
    id: `mock-dish-${restaurantName}-${i}`,
    name: `${d.name} (${restaurantName})`,
    priceInCent: d.price,
    restaurantName: restaurantName,
    restaurantId: `mock-rest-${restaurantName}`,
    rating: 4 + Math.random()
  }));
};

// ============================================================================
// Authentication API
// ============================================================================

const DEFAULT_PROXY_URL = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8080';

interface LoginResponse {
  success: boolean;
  sessionId?: string;
  message?: string;
  error?: string;
}

/**
 * Login to Meican with username and password
 */
export const login = async (
  username: string,
  password: string,
  proxyUrl?: string
): Promise<LoginResponse> => {
  const baseUrl = proxyUrl || DEFAULT_PROXY_URL;
  
  try {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[MeicanService] Login error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Login failed',
    };
  }
};

/**
 * Logout and clear session
 */
export const logout = async (prefs: UserPreferences): Promise<boolean> => {
  if (!prefs.sessionId) return true;
  
  const baseUrl = prefs.proxyUrl || DEFAULT_PROXY_URL;
  
  try {
    await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': prefs.sessionId,
      },
    });
    return true;
  } catch (error) {
    console.error('[MeicanService] Logout error:', error);
    return false;
  }
};

/**
 * Check authentication status
 */
export const checkAuthStatus = async (prefs: UserPreferences): Promise<boolean> => {
  if (!prefs.sessionId) return false;
  
  const baseUrl = prefs.proxyUrl || DEFAULT_PROXY_URL;
  
  try {
    const response = await fetch(`${baseUrl}/api/auth/status`, {
      headers: {
        'X-Session-Id': prefs.sessionId,
      },
    });
    const data = await response.json();
    return data.authenticated === true;
  } catch {
    return false;
  }
};

// ============================================================================
// API Request Helper
// ============================================================================

interface ApiRequestOptions {
  method?: 'GET' | 'POST';
  path: string;
  query?: Record<string, string>;
  body?: Record<string, unknown>;
  prefs: UserPreferences;
}

/**
 * Make a request to the backend proxy
 */
const apiRequest = async <T>(options: ApiRequestOptions): Promise<T> => {
  const { method = 'GET', path, query, body, prefs } = options;
  
  const baseUrl = prefs.proxyUrl || DEFAULT_PROXY_URL;
  const url = new URL(path, baseUrl);
  
  // Add query parameters
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  // Build headers with session-based authentication
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (prefs.sessionId) {
    headers['X-Session-Id'] = prefs.sessionId;
  }

  const requestOptions: RequestInit = {
    method,
    headers,
  };

  if (method === 'POST' && body) {
    requestOptions.body = JSON.stringify(body);
  }

  console.log(`[MeicanService] ${method} ${url.pathname}${url.search}`);

  const response = await fetch(url.toString(), requestOptions);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `API Error: ${response.status}`);
  }

  return response.json();
};

// ============================================================================
// Calendar API
// ============================================================================

interface MeicanDish {
  id: number;
  name: string;
  priceInCent: number;
  priceString: string;
}

interface DishItem {
  dish: MeicanDish;
  count: number;
}

interface RestaurantItem {
  uniqueId: string;
  dishItemList: DishItem[];
}

interface CorpOrderUser {
  uniqueId: string;
  restaurantItemList: RestaurantItem[];
  corpOrderStatus: string;
  userAddressUniqueId?: string;
  corpAddress?: {
    uniqueId?: string;
    address: string;
    pickUpLocation: string;
  };
  postbox?: {
    postboxCode: string;
  };
  corp?: {
    namespace?: string;
  };
}

interface CalendarItem {
  title: string;
  targetTime: number;
  status: 'CLOSED' | 'ORDER' | 'AVAILABLE';
  reason?: string;
  userTab: { 
    uniqueId: string;
    name: string;
  };
  openingTime: {
    name: string;
    openTime: string;
    closeTime: string;
    uniqueId?: string;
  };
  corpOrderUser: CorpOrderUser | null;
  corp?: {
    namespace?: string;
  };
}

interface CalendarDate {
  date: string;
  calendarItemList: CalendarItem[];
}

interface CalendarResponse {
  dateList: CalendarDate[];
  startDate: string;
  endDate: string;
}

/**
 * Get calendar status for a date range
 */
export const getCalendarStatus = async (
  startDate: Date, 
  endDate: Date, 
  prefs: UserPreferences
): Promise<DailyStatus[]> => {
  // Use mock data if enabled
  if (prefs.useMockData) {
    const days: DailyStatus[] = [];
    const curr = new Date(startDate);
    while (curr <= endDate) {
      const dateStr = formatDate(curr);
      const dayOfWeek = curr.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        days.push({
          date: dateStr,
          status: Math.random() > 0.3 ? OrderStatus.AVAILABLE : OrderStatus.ORDERED,
          mealTime: MealTime.LUNCH,
          tabUniqueId: `tab-lunch-${dateStr}`,
          currentOrder: Math.random() > 0.7 ? generateMockMenu(MOCK_RESTAURANTS[0])[0] : undefined
        });
        days.push({
          date: dateStr,
          status: OrderStatus.AVAILABLE,
          mealTime: MealTime.DINNER,
          tabUniqueId: `tab-dinner-${dateStr}`
        });
      }
      curr.setDate(curr.getDate() + 1);
    }
    return days;
  }

  // Real API call
  try {
    const beginDate = formatDate(startDate);
    const endDateStr = formatDate(endDate);

    const response = await apiRequest<CalendarResponse>({
      method: 'GET',
      path: '/api/calendarItems/list',
      query: {
        beginDate,
        endDate: endDateStr,
        withOrderDetail: 'true',
      },
      prefs,
    });

    // Transform response to DailyStatus[]
    const days: DailyStatus[] = [];
    
    for (const dateItem of response.dateList || []) {
      for (const calItem of dateItem.calendarItemList || []) {
        // Determine meal time from title or openingTime name
        const titleLower = (calItem.title || '').toLowerCase();
        const openingName = (calItem.openingTime?.name || '').toLowerCase();
        
        let mealTime: MealTime;
        if (titleLower.includes('早餐') || openingName.includes('早餐') || titleLower.includes('breakfast')) {
          mealTime = MealTime.BREAKFAST;
        } else if (titleLower.includes('午餐') || openingName.includes('午餐') || titleLower.includes('lunch')) {
          mealTime = MealTime.LUNCH;
        } else {
          mealTime = MealTime.DINNER;
        }

        // Map status
        let status: OrderStatus;
        switch (calItem.status) {
          case 'ORDER':
            status = OrderStatus.ORDERED;
            break;
          case 'CLOSED':
            status = OrderStatus.CLOSED;
            break;
          case 'AVAILABLE':
          default:
            status = OrderStatus.AVAILABLE;
        }

        // Extract current order from corpOrderUser if exists
        let currentOrder: Dish | undefined;
        let orderUniqueId: string | undefined;
        let userAddressUniqueId: string | undefined;
        if (calItem.corpOrderUser?.restaurantItemList?.length > 0) {
          orderUniqueId = calItem.corpOrderUser.uniqueId;
          // Extract address ID for reuse when placing new orders
          userAddressUniqueId = calItem.corpOrderUser.userAddressUniqueId || 
                                calItem.corpOrderUser.corpAddress?.uniqueId;
          const restaurantItem = calItem.corpOrderUser.restaurantItemList[0];
          if (restaurantItem.dishItemList?.length > 0) {
            const dishItem = restaurantItem.dishItemList[0];
            currentOrder = {
              id: String(dishItem.dish.id),
              name: dishItem.dish.name,
              priceInCent: dishItem.dish.priceInCent,
              restaurantName: '', // Not directly available in this structure
              restaurantId: restaurantItem.uniqueId,
            };
          }
        }

        // Get closeTime from openingTime if available
        const closeTime = calItem.openingTime?.closeTime;

        // Get namespace from corpOrderUser.corp or calItem.corp
        let namespace = calItem.corpOrderUser?.corp?.namespace || calItem.corp?.namespace;

        // Debug logging for missing namespace
        if (!namespace && status === OrderStatus.AVAILABLE) {
          console.warn('[MeicanService] Namespace missing for item:', {
            date: dateItem.date,
            title: calItem.title,
            keys: Object.keys(calItem),
            userTab: calItem.userTab,
            corpOrderUser: calItem.corpOrderUser,
            corp: calItem.corp
          });
          
          // Fallback attempts
          if (calItem.userTab && (calItem.userTab as any).corp) {
             namespace = (calItem.userTab as any).corp?.namespace;
          }
        }

        days.push({
          date: dateItem.date,
          status,
          mealTime,
          tabUniqueId: calItem.userTab?.uniqueId,
          currentOrder,
          closeTime,
          orderUniqueId,
          userAddressUniqueId,
          namespace,
        });
      }
    }

    return days;
  } catch (e) {
    console.error('[MeicanService] Calendar API Error:', e);
    throw e;
  }
};

// ============================================================================
// Dishes API
// ============================================================================

interface DishItem {
  id: string;
  name: string;
  priceInCent: number;
  restaurant: {
    uniqueId: string;
    name: string;
  };
}

interface DishesResponse {
  othersRegularDishList: DishItem[];
}

/**
 * Get available dishes for a meal slot
 */
export const getAvailableDishes = async (
  tabUniqueId: string, 
  targetTime: string, 
  prefs: UserPreferences
): Promise<Dish[]> => {
  // Use mock data if enabled
  if (prefs.useMockData) {
    let allDishes: Dish[] = [];
    MOCK_RESTAURANTS.forEach(rest => {
      allDishes = [...allDishes, ...generateMockMenu(rest)];
    });
    return allDishes;
  }
  
  // Real API call
  try {
    const response = await apiRequest<DishesResponse>({
      method: 'GET',
      path: '/api/recommendations/dishes',
      query: {
        tabUniqueId,
        targetTime,
      },
      prefs,
    });

    // Transform response to Dish[]
    return (response.othersRegularDishList || []).map(dish => ({
      id: dish.id,
      name: dish.name,
      priceInCent: dish.priceInCent,
      restaurantName: dish.restaurant.name,
      restaurantId: dish.restaurant.uniqueId,
    }));
  } catch (e) {
    console.error('[MeicanService] Dishes API Error:', e);
    throw e;
  }
};

// ============================================================================
// Restaurants API (For Breakfast)
// ============================================================================

interface RestaurantListResponse {
  restaurantList: {
    uniqueId: string;
    name: string;
    // other fields ignored
  }[];
}

/**
 * Get available restaurants for a meal slot (for Breakfast mainly)
 */
export const getRestaurants = async (
  tabUniqueId: string,
  targetTime: string,
  prefs: UserPreferences
): Promise<Dish[]> => {
  if (prefs.useMockData) {
    return MOCK_RESTAURANTS.map((r, i) => ({
      id: `mock-rest-${i}`,
      name: r,
      priceInCent: 0,
      restaurantName: r,
      restaurantId: `mock-rest-${i}`,
    }));
  }

  try {
    const response = await apiRequest<RestaurantListResponse>({
      method: 'GET',
      path: '/api/restaurants/list',
      query: {
        tabUniqueId,
        targetTime,
      },
      prefs,
    });

    // Map restaurants to Dish-like objects for UI compatibility
    // Use restaurant uniqueId as dish ID
    return (response.restaurantList || []).map(r => ({
      id: r.uniqueId,           // Use restaurant ID as dish ID
      name: r.name,             // Restaurant name as dish name
      priceInCent: 0,           // Price unknown
      restaurantName: r.name,
      restaurantId: r.uniqueId,
    }));
  } catch (e) {
    console.error('[MeicanService] Restaurants API Error:', e);
    throw e;
  }
};

// ============================================================================
// Address API
// ============================================================================

export interface Address {
  uniqueId: string;
  name: string;
}

interface RecentAddress {
  uniqueId: string;
  pickUpLocation: string;
  address?: string;
}

interface AddressListItem {
  finalValue: {
    uniqueId: string;
    pickUpLocation: string;
  };
  name: string;
}

interface AddressResponse {
  data: {
    addressList: AddressListItem[];
    recentList: RecentAddress[];
  };
}

/**
 * Get user addresses
 * @param prefs User preferences
 * @param namespace Corp namespace (different per meal time: breakfast, lunch, dinner)
 * @returns Object with addresses list and suggested default (from recentList[0])
 */
export const getAddresses = async (prefs: UserPreferences, namespace?: string): Promise<{ addresses: Address[]; defaultAddressId?: string }> => {
  if (prefs.useMockData) {
    return { 
      addresses: [{ uniqueId: 'mock-address-1', name: 'Default Address' }],
      defaultAddressId: 'mock-address-1'
    };
  }

  try {
    const query: Record<string, string> = {};
    if (namespace) {
      query.namespace = namespace;
    }
    const response = await apiRequest<AddressResponse>({
      method: 'GET',
      path: '/api/corpaddresses/getmulticorpaddress',
      query,
      prefs,
    });

    // Get default from recentList[0] if available
    const recentList = response.data?.recentList || [];
    const defaultAddressId = recentList.length > 0 ? recentList[0].uniqueId : undefined;

    // Return addressList (all available delivery locations)
    const addressList = response.data?.addressList || [];
    if (addressList.length > 0) {
      return {
        addresses: addressList.map(a => ({
          uniqueId: a.finalValue.uniqueId,
          name: a.name || a.finalValue.pickUpLocation,
        })),
        defaultAddressId,
      };
    }

    // Fall back to recentList if addressList is empty
    return {
      addresses: recentList.map(a => ({
        uniqueId: a.uniqueId,
        name: a.pickUpLocation,
      })),
      defaultAddressId,
    };
  } catch (e) {
    console.error('[MeicanService] Address API Error:', e);
    throw e;
  }
};

// ============================================================================
// Order API
// ============================================================================

interface OrderResponse {
  status: 'SUCCESSFUL' | 'FAILED';
  order?: { uniqueId: string };
  message?: string;
}

/**
 * Place an order
 * @param tabUniqueId Tab unique ID for the meal slot
 * @param dishId Dish ID to order
 * @param targetTime Target delivery time
 * @param prefs User preferences
 * @param corpAddressUniqueId Corp address unique ID (from getmulticorpaddress)
 * @param userAddressUniqueId User address unique ID (optional, defaults to corpAddressUniqueId)
 */
export const placeOrder = async (
  tabUniqueId: string, 
  dishId: string, 
  targetTime: string, 
  prefs: UserPreferences,
  corpAddressUniqueId?: string,
  userAddressUniqueId?: string
): Promise<{ success: boolean; orderId?: string }> => {
  // Use mock data if enabled
  if (prefs.useMockData) {
    await new Promise(r => setTimeout(r, 800));
    return { success: true, orderId: `mock-order-${Date.now()}` };
  }

  try {
    // corpAddressUniqueId is required
    if (!corpAddressUniqueId) {
      throw new Error('No delivery address available. Please set a default address in Settings.');
    }
    
    // userAddressUniqueId defaults to corpAddressUniqueId if not provided
    const userAddr = userAddressUniqueId || corpAddressUniqueId;

    const response = await apiRequest<OrderResponse>({
      method: 'POST',
      path: '/api/orders/add',
      body: {
        tabUniqueId,
        order: JSON.stringify([{ count: 1, dishId }]),
        remarks: JSON.stringify([{ dishId, remark: '' }]),
        targetTime,
        userAddressUniqueId: userAddr,
        corpAddressUniqueId: corpAddressUniqueId,
      },
      prefs,
    });

    if (response.status === 'SUCCESSFUL') {
      return { success: true, orderId: response.order?.uniqueId };
    } else {
      throw new Error(response.message || 'Order failed');
    }
  } catch (e) {
    console.error('[MeicanService] Order API Error:', e);
    return { success: false };
  }
};

/**
 * Delete an order
 */
export const deleteOrder = async (
  orderUniqueId: string,
  prefs: UserPreferences
): Promise<{ success: boolean }> => {
  if (prefs.useMockData) {
    await new Promise(r => setTimeout(r, 500));
    return { success: true };
  }

  try {
    const response = await apiRequest<OrderResponse>({
      method: 'POST',
      path: '/api/orders/delete',
      body: {
        uniqueId: orderUniqueId,
        type: 'CORP_ORDER',
        restoreCart: false,
      },
      prefs,
    });

    return { success: response.status === 'SUCCESSFUL' };
  } catch (e) {
    console.error('[MeicanService] Delete Order API Error:', e);
    return { success: false };
  }
};

// ============================================================================
// History API
// ============================================================================

interface HistoryResponse {
  orders: Omit<HistoricalOrder, 'id'>[];
}

/**
 * Fetch order history from the backend API
 * @param startDate - Start date for history range
 * @param endDate - End date for history range
 * @param prefs - User preferences containing session info
 * @returns Array of historical orders without DB id
 */
export const fetchOrderHistory = async (
  startDate: Date,
  endDate: Date,
  prefs: UserPreferences
): Promise<Omit<HistoricalOrder, 'id'>[]> => {
  // Use mock data if enabled
  if (prefs.useMockData) {
    const mockOrders: Omit<HistoricalOrder, 'id'>[] = [];
    const curr = new Date(startDate);
    while (curr <= endDate) {
      const dateStr = formatDate(curr);
      const dayOfWeek = curr.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        mockOrders.push({
          date: dateStr,
          mealTime: MealTime.LUNCH,
          dishName: MOCK_DISHES[Math.floor(Math.random() * MOCK_DISHES.length)].name,
          restaurantName: MOCK_RESTAURANTS[Math.floor(Math.random() * MOCK_RESTAURANTS.length)],
          priceInCent: 3000 + Math.floor(Math.random() * 3000),
        });
      }
      curr.setDate(curr.getDate() + 1);
    }
    return mockOrders;
  }

  // Real API call
  try {
    const beginDate = formatDate(startDate);
    const endDateStr = formatDate(endDate);

    const response = await apiRequest<HistoryResponse>({
      method: 'GET',
      path: '/api/history/orders',
      query: {
        beginDate,
        endDate: endDateStr,
      },
      prefs,
    });

    return response.orders || [];
  } catch (e) {
    console.error('[MeicanService] History API Error:', e);
    throw e;
  }
};
