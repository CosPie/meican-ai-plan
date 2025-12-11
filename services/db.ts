import { HistoricalOrder, UserPreferences } from '../types';
import { fetchOrderHistory } from './meicanService';

const DB_NAME = 'MeicanAI_DB';
const DB_VERSION = 1;
const STORE_ORDERS = 'orders';
const STORE_SETTINGS = 'settings';

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => reject('IndexedDB error: ' + (event.target as IDBOpenDBRequest).error);

    request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_ORDERS)) {
        const orderStore = db.createObjectStore(STORE_ORDERS, { keyPath: 'id', autoIncrement: true });
        orderStore.createIndex('date', 'date', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
      }
    };
  });
};

export const saveOrderHistory = async (orders: Omit<HistoricalOrder, 'id'>[]): Promise<void> => {
  const db = await initDB();
  const tx = db.transaction(STORE_ORDERS, 'readwrite');
  const store = tx.objectStore(STORE_ORDERS);
  
  // Simple deduplication check could happen here, but for now we append
  orders.forEach(order => store.add(order));
  
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve();
  });
};

/**
 * Get order history from IndexedDB.
 * If no data exists and prefs are provided, fetches from API and saves to DB.
 */
export const getOrderHistory = async (prefs?: UserPreferences): Promise<HistoricalOrder[]> => {
  const db = await initDB();
  
  // First, try to get from IndexedDB
  const existingOrders: HistoricalOrder[] = await new Promise((resolve) => {
    const tx = db.transaction(STORE_ORDERS, 'readonly');
    const store = tx.objectStore(STORE_ORDERS);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
  });

  // If we have existing orders, return them
  if (existingOrders.length > 0) {
    return existingOrders;
  }

  // If no prefs provided, cannot fetch from API
  if (!prefs || !prefs.sessionId) {
    console.log('[DB] No existing orders and no session - returning empty array');
    return [];
  }

  // Fetch from API (last 30 days by default)
  console.log('[DB] No existing orders - fetching from API...');
  try {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const apiOrders = await fetchOrderHistory(thirtyDaysAgo, today, prefs);
    
    if (apiOrders.length > 0) {
      // Save to IndexedDB
      await saveOrderHistory(apiOrders);
      console.log(`[DB] Saved ${apiOrders.length} orders from API to IndexedDB`);
      
      // Return the saved orders (with IDs)
      return getOrderHistory(); // Recursive call to get orders with IDs
    }
    
    return [];
  } catch (error) {
    console.error('[DB] Failed to fetch order history from API:', error);
    return [];
  }
};

export const savePreferences = async (prefs: UserPreferences): Promise<void> => {
  const db = await initDB();
  const tx = db.transaction(STORE_SETTINGS, 'readwrite');
  const store = tx.objectStore(STORE_SETTINGS);
  store.put({ key: 'user_prefs', ...prefs });
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve();
  });
};

export const getPreferences = async (): Promise<UserPreferences | null> => {
  const db = await initDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_SETTINGS, 'readonly');
    const store = tx.objectStore(STORE_SETTINGS);
    const request = store.get('user_prefs');
    request.onsuccess = () => resolve(request.result ? (request.result as UserPreferences) : null);
  });
};
