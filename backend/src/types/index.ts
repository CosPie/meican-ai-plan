// Meican API Types

export interface MeicanCredentials {
  cookie: string;
  accessToken?: string;
  clientId: string;
  clientSecret: string;
}

export interface CalendarItem {
  title: string; // "午餐" or "晚餐"
  status: 'CLOSED' | 'ORDER' | 'AVAILABLE';
  userTab: {
    uniqueId: string;
  };
  order?: {
    uniqueId: string;
    dish: {
      id: string;
      name: string;
      priceInCent: number;
    };
    restaurant: {
      uniqueId: string;
      name: string;
    };
  };
}

export interface CalendarDate {
  date: string;
  calendarItemList: CalendarItem[];
}

export interface CalendarResponse {
  dateList: CalendarDate[];
}

export interface Address {
  uniqueId: string;
  name: string;
  address: string;
}

export interface AddressResponse {
  data: {
    addressList: {
      finalValue: Address;
    }[];
    recentList: Address[];
  };
}

export interface Restaurant {
  uniqueId: string;
  name: string;
  rating?: number;
}

export interface RestaurantsResponse {
  restaurantList: Restaurant[];
}

export interface Dish {
  id: string;
  name: string;
  priceInCent: number;
  restaurant: {
    uniqueId: string;
    name: string;
  };
}

export interface DishesResponse {
  othersRegularDishList: Dish[];
}

export interface OrderRequest {
  tabUniqueId: string;
  order: string; // JSON string: [{"count":1, "dishId": 123}]
  remarks: string; // JSON string: [{"dishId":"123", "remark":""}]
  targetTime: string; // YYYY-MM-DD HH:mm
  userAddressUniqueId: string;
  corpAddressUniqueId: string;
  corpAddressRemark?: string;
}

export interface OrderResponse {
  status: 'SUCCESSFUL' | 'FAILED';
  order?: {
    uniqueId: string;
  };
  message?: string;
}

export interface DeleteOrderRequest {
  uniqueId: string;
  type: string; // 'CORP_ORDER'
  restoreCart: string; // 'false'
}

export interface ApiError {
  code: string;
  message: string;
}
