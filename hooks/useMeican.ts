import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getCalendarStatus, 
  getAvailableDishes, 
  getRestaurants, 
  getAddresses, 
  Address,
  checkAuthStatus, 
  login, 
  logout, 
  placeOrder, 
  deleteOrder, 
  fetchOrderHistory 
} from '../services/meicanService';
import { UserPreferences, DailyStatus, Dish, HistoricalOrder } from '../types';

export type { Address };

// Query Keys
export const meicanKeys = {
  all: ['meican'] as const,
  calendar: (startDate: Date, endDate: Date, sessionId?: string) => [...meicanKeys.all, 'calendar', startDate.toISOString(), endDate.toISOString(), sessionId || 'guest'] as const,
  dishes: (tabUniqueId: string, targetTime: string) => [...meicanKeys.all, 'dishes', tabUniqueId, targetTime] as const,
  restaurants: (tabUniqueId: string, targetTime: string) => [...meicanKeys.all, 'restaurants', tabUniqueId, targetTime] as const,
  addresses: (namespace?: string) => [...meicanKeys.all, 'addresses', namespace] as const,
  authStatus: ['meican', 'auth'] as const,
  history: (startDate: Date, endDate: Date) => [...meicanKeys.all, 'history', startDate.toISOString(), endDate.toISOString()] as const,
};

// Hooks

export const useCalendarStatus = (startDate: Date, endDate: Date, prefs: UserPreferences | null) => {
  return useQuery({
    queryKey: meicanKeys.calendar(startDate, endDate, prefs?.sessionId),
    queryFn: () => getCalendarStatus(startDate, endDate, prefs!),
    enabled: !!prefs && (!!prefs.sessionId || prefs.useMockData) && !!startDate && !!endDate,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const useAvailableDishes = (tabUniqueId: string | undefined, targetTime: string | undefined, prefs: UserPreferences | null) => {
  return useQuery({
    queryKey: meicanKeys.dishes(tabUniqueId!, targetTime!),
    queryFn: () => getAvailableDishes(tabUniqueId!, targetTime!, prefs!),
    enabled: !!prefs && (!!prefs.sessionId || prefs.useMockData) && !!tabUniqueId && !!targetTime,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
};

export const useRestaurants = (tabUniqueId: string | undefined, targetTime: string | undefined, prefs: UserPreferences | null) => {
  return useQuery({
    queryKey: meicanKeys.restaurants(tabUniqueId!, targetTime!),
    queryFn: () => getRestaurants(tabUniqueId!, targetTime!, prefs!),
    enabled: !!prefs && (!!prefs.sessionId || prefs.useMockData) && !!tabUniqueId && !!targetTime,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
};

export const useUserAddresses = (prefs: UserPreferences | null, namespace?: string) => {
  return useQuery({
    queryKey: meicanKeys.addresses(namespace),
    queryFn: () => getAddresses(prefs!, namespace),
    enabled: !!prefs && (!!prefs.sessionId || prefs.useMockData),
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
};

export const useAuthStatus = (prefs: UserPreferences | null) => {
  return useQuery({
    queryKey: meicanKeys.authStatus,
    queryFn: () => checkAuthStatus(prefs!),
    enabled: !!prefs && !!prefs.sessionId,
    retry: false,
  });
};

export const useOrderHistory = (startDate: Date, endDate: Date, prefs: UserPreferences | null) => {
  return useQuery({
    queryKey: meicanKeys.history(startDate, endDate),
    queryFn: () => fetchOrderHistory(startDate, endDate, prefs!),
    enabled: !!prefs && (!!prefs.sessionId || prefs.useMockData) && !!startDate && !!endDate,
  });
};

// Mutations

export const useLogin = () => {
  return useMutation({
    mutationFn: ({ username, password, proxyUrl }: { username: string; password: string; proxyUrl?: string }) => 
      login(username, password, proxyUrl),
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (prefs: UserPreferences) => logout(prefs),
    onSuccess: () => {
      queryClient.setQueryData(meicanKeys.authStatus, false);
      queryClient.clear(); // Clear all cache on logout
    },
  });
};

export const usePlaceOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ 
      tabUniqueId, 
      dishId, 
      targetTime, 
      prefs, 
      corpAddressUniqueId, 
      userAddressUniqueId 
    }: { 
      tabUniqueId: string; 
      dishId: string; 
      targetTime: string; 
      prefs: UserPreferences; 
      corpAddressUniqueId?: string; 
      userAddressUniqueId?: string; 
    }) => placeOrder(tabUniqueId, dishId, targetTime, prefs, corpAddressUniqueId, userAddressUniqueId),
    onSuccess: () => {
      // Invalidate calendar to refresh status
      queryClient.invalidateQueries({ queryKey: meicanKeys.all });
    },
  });
};

export const useDeleteOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderUniqueId, prefs }: { orderUniqueId: string; prefs: UserPreferences }) => 
      deleteOrder(orderUniqueId, prefs),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: meicanKeys.all });
    },
  });
};
