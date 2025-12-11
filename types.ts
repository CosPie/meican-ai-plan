export enum MealTime {
  BREAKFAST = 'BREAKFAST',
  LUNCH = 'LUNCH',
  DINNER = 'DINNER'
}

export enum OrderStatus {
  AVAILABLE = 'AVAILABLE',
  ORDERED = 'ORDER',
  CLOSED = 'CLOSED',
  NO_SERVICE = 'NO_SERVICE'
}

export interface UserPreferences {
  username: string;
  password: string;
  sessionId: string; // Obtained after login
  proxyUrl: string; // e.g., http://localhost:8080/
  useMockData: boolean;
  excludedKeywords: string[]; // e.g. ["peanuts", "spicy"]
  vendorWeights: Record<string, number>; // e.g. {"KFC": -1, "HealthySalad": 10}
  planningMode: 'balanced' | 'health' | 'preference';
  defaultAddressId?: string; // Selected default delivery address ID
  enableBreakfast?: boolean; // Default false
  enableWeekends?: boolean; // Default false
  
  // AI Provider Config
  aiProvider: 'gemini' | 'custom';
  geminiApiKey?: string;
  customAiBaseUrl?: string; // e.g. https://api.openai.com/v1
  customAiApiKey?: string;
  customAiModel?: string; // e.g. gpt-4o
}

export interface Dish {
  id: string; // uniqueId
  name: string;
  priceInCent: number;
  restaurantName: string;
  restaurantId: string;
  rating?: number;
}

export interface DailyStatus {
  date: string; // YYYY-MM-DD
  status: OrderStatus;
  tabUniqueId?: string;
  mealTime: MealTime;
  currentOrder?: Dish;
  closeTime?: string; // e.g., "2024-12-10 10:00" - deadline for modifications
  orderUniqueId?: string; // ID of the current order for delete/edit operations
  userAddressUniqueId?: string; // Address ID for reusing when placing orders
  namespace?: string; // Corp namespace for fetching addresses (different per meal time)
}

export interface PlannedOrder {
  date: string;
  mealTime: MealTime;
  dish: Dish;
  reason: string;
  tabUniqueId: string;
  userAddressUniqueId?: string; // Address ID for placing orders
  namespace?: string; // Corp namespace for fetching addresses
}

export interface HistoricalOrder {
  id: number; // DB Primary Key
  date: string;
  mealTime: MealTime;
  dishName: string;
  restaurantName: string;
  priceInCent: number;
  calories?: number; // Estimated by AI
}

export interface AnalysisResult {
  summary: string;
  score: number;
  suggestions: string[];
  calorieTrend: { date: string; calories: number }[];
  cuisineDistribution: { name: string; value: number }[];
  modelName?: string;
}