import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DailyStatus, Dish, MealTime, UserPreferences } from '../types';
import { Address } from '../services/meicanService';
import { useAvailableDishes, useRestaurants, useUserAddresses, usePlaceOrder, useDeleteOrder } from '../hooks/useMeican';
import { motion } from 'framer-motion';

interface Props {
  slot: DailyStatus;
  prefs: UserPreferences;
  onClose: () => void;
  onOrderUpdated: () => void;
}

const getTargetTimeForMeal = (mealTime: MealTime): string => {
  switch (mealTime) {
    case MealTime.BREAKFAST:
      return '07:00';
    case MealTime.LUNCH:
      return '09:00'; // Confirmed by user
    case MealTime.DINNER:
      return '12:00'; // Confirmed by user to work, 17:00 failed
    default:
      return '09:00';
  }
};

const OrderEditModal: React.FC<Props> = ({ slot, prefs, onClose, onOrderUpdated }) => {
  const { t } = useTranslation();
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const timeStr = getTargetTimeForMeal(slot.mealTime);
  const targetTime = `${slot.date} ${timeStr}`;
  const isBreakfast = slot.mealTime === MealTime.BREAKFAST;

  // Hooks
  const { data: regularDishes = [], isLoading: loadingRegular } = useAvailableDishes(
    !isBreakfast ? slot.tabUniqueId : undefined, 
    !isBreakfast ? targetTime : undefined, 
    prefs
  );

  const { data: restaurantDishes = [], isLoading: loadingRestaurant } = useRestaurants(
    isBreakfast ? slot.tabUniqueId : undefined, 
    isBreakfast ? targetTime : undefined, 
    prefs
  );

  const dishes = isBreakfast ? restaurantDishes : regularDishes;
  const isLoadingDishes = isBreakfast ? loadingRestaurant : loadingRegular;

  const { data: addressData, isLoading: loadingAddress } = useUserAddresses(prefs, slot.namespace);
  const addresses = addressData?.addresses || [];

  const placeOrderMutation = usePlaceOrder();
  const deleteOrderMutation = useDeleteOrder();

  // Effect to set default address
  useEffect(() => {
    if (addressData?.addresses && addressData.addresses.length > 0 && !selectedAddress) {
      const defaultAddr = addressData.defaultAddressId 
        ? addressData.addresses.find(a => a.uniqueId === addressData.defaultAddressId) 
        : addressData.addresses[0];
      setSelectedAddress(defaultAddr || addressData.addresses[0]);
    }
  }, [addressData, selectedAddress]);

  // Check if modification is still allowed
  const isModificationAllowed = (): boolean => {
    if (!slot.closeTime) return true;
    
    let closeDate: Date;
    if (slot.closeTime.includes('-')) {
      closeDate = new Date(slot.closeTime.replace(' ', 'T'));
    } else {
      closeDate = new Date(`${slot.date}T${slot.closeTime}`);
    }
    
    return new Date() < closeDate;
  };

  const handleDelete = async () => {
    if (!slot.orderUniqueId) {
      setError('No order to delete');
      return;
    }
    setError(null);
    try {
      await deleteOrderMutation.mutateAsync({ orderUniqueId: slot.orderUniqueId, prefs });
      onOrderUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete order');
    }
  };

  const handleOrder = async () => {
    if (!selectedDish || !slot.tabUniqueId) return;
    setError(null);
    
    try {
      // If there's an existing order, delete it first
      if (slot.orderUniqueId) {
        await deleteOrderMutation.mutateAsync({ orderUniqueId: slot.orderUniqueId, prefs });
      }

      const addressId = selectedAddress?.uniqueId || slot.userAddressUniqueId;
      await placeOrderMutation.mutateAsync({
        tabUniqueId: slot.tabUniqueId,
        dishId: selectedDish.id,
        targetTime,
        prefs,
        corpAddressUniqueId: addressId,
        userAddressUniqueId: addressId
      });
      
      onOrderUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place order');
    }
  };

  // Filter dishes based on search query
  const filteredDishes = dishes.filter(dish => 
    dish.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    dish.restaurantName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group dishes by restaurant
  const groupedDishes = filteredDishes.reduce((acc, dish) => {
    const restaurant = dish.restaurantName || 'Other';
    if (!acc[restaurant]) {
      acc[restaurant] = [];
    }
    acc[restaurant].push(dish);
    return acc;
  }, {} as Record<string, Dish[]>);

  const mealTimeLabel = slot.mealTime.charAt(0) + slot.mealTime.slice(1).toLowerCase();
  const formattedDate = new Date(slot.date).toLocaleDateString(undefined, { 
    weekday: 'long', 
    month: 'short', 
    day: 'numeric' 
  });
  
  const isActionLoading = placeOrderMutation.isPending || deleteOrderMutation.isPending;
  const isLoading = isLoadingDishes || loadingAddress;

  if (!isModificationAllowed()) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      >
        <motion.div 
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0.9 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="bg-[#252525] rounded-3xl shadow-2xl p-8 w-full max-w-md border border-white/10"
        >
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
              <span className="text-3xl">⏰</span>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">{t('orderEdit.deadlinePassed')}</h2>
            <p className="text-gray-400 mb-6">
              {t('orderEdit.deadlineMessage', { time: slot.closeTime })}
            </p>
            <button 
              onClick={onClose}
              className="px-6 py-2.5 bg-[#333] hover:bg-[#444] text-white rounded-full transition-colors"
            >
              {t('app.close')}
            </button>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="bg-[#252525] rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-white/10 overflow-hidden"
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-white/10">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-[#6FB92D]">✎</span> {t('orderEdit.modifyOrder')}
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              {formattedDate} · {mealTimeLabel}
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-white transition-colors text-xl w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        {/* Current Order Section */}
        {slot.currentOrder && (
          <div className="px-6 py-4 bg-[#6FB92D]/10 border-b border-[#6FB92D]/20">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-gray-400 mb-1">{t('orderEdit.currentOrder')}</p>
                <p className="text-[#6FB92D] font-bold">{slot.currentOrder.name}</p>
                <p className="text-xs text-gray-500">{slot.currentOrder.restaurantName}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-white font-mono">
                  ¥{(slot.currentOrder.priceInCent / 100).toFixed(2)}
                </span>
                <button
                  onClick={handleDelete}
                  disabled={isActionLoading}
                  className="px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-full text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {deleteOrderMutation.isPending ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      {t('orderEdit.deleting')}
                    </>
                  ) : (
                    <>{t('orderEdit.deleteOrder')}</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="px-6 py-4 border-b border-white/5">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('orderEdit.searchPlaceholder')}
              className="w-full bg-[#1e1e1e] border border-[#333] rounded-xl px-4 py-3 pl-10 text-white placeholder-gray-500 focus:outline-none focus:border-[#6FB92D]/50 transition-colors"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
          </div>
        </div>

        {/* Address Selection */}
        {addresses.length > 0 && (
          <div className="px-6 py-4 border-b border-white/5">
            <label className="block text-xs text-gray-400 mb-2">{t('orderEdit.deliveryAddress')}</label>
            <select
              value={selectedAddress?.uniqueId || ''}
              onChange={(e) => {
                const addr = addresses.find(a => a.uniqueId === e.target.value);
                setSelectedAddress(addr || null);
              }}
              className="w-full bg-[#1e1e1e] border border-[#333] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#6FB92D]/50 transition-colors appearance-none cursor-pointer"
            >
              {addresses.map((addr) => (
                <option key={addr.uniqueId} value={addr.uniqueId}>
                  📍 {addr.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2">
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Dishes List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {isLoading ? (
            <div className="space-y-6">
              {[1, 2, 3].map(i => (
                <div key={i}>
                  <div className="h-4 w-24 bg-[#333] rounded mb-3 animate-pulse"></div>
                  <div className="space-y-2">
                    {[1, 2].map(j => (
                      <div key={j} className="h-20 bg-[#252525] border border-[#333] rounded-xl p-4 flex justify-between items-center animate-pulse">
                        <div className="space-y-2">
                          <div className="h-4 w-40 bg-[#333] rounded"></div>
                          <div className="h-3 w-20 bg-[#333] rounded"></div>
                        </div>
                        <div className="h-6 w-16 bg-[#333] rounded"></div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : Object.keys(groupedDishes).length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-[#333] rounded-full flex items-center justify-center">
                <span className="text-2xl">🍽️</span>
              </div>
              <p className="text-gray-400">
                {searchQuery ? t('orderEdit.noMatchingDishes') : t('orderEdit.noAvailableDishes')}
              </p>
            </div>
          ) : (
            Object.entries(groupedDishes).map(([restaurant, restaurantDishes]) => (
              <div key={restaurant}>
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-[#6FB92D] rounded-full"></span>
                  {restaurant}
                </h3>
                <div className="space-y-2">
                  {restaurantDishes.map((dish) => (
                    <button
                      key={dish.id}
                      onClick={() => setSelectedDish(selectedDish?.id === dish.id ? null : dish)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                        selectedDish?.id === dish.id
                          ? 'bg-[#6FB92D]/10 border-[#6FB92D] text-white'
                          : 'bg-[#1e1e1e] border-[#333] hover:border-[#555] text-gray-300'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className={`font-medium ${selectedDish?.id === dish.id ? 'text-[#6FB92D]' : ''}`}>
                            {dish.name}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-white">
                            ¥{(dish.priceInCent / 100).toFixed(2)}
                          </span>
                          {selectedDish?.id === dish.id && (
                            <span className="w-6 h-6 bg-[#6FB92D] rounded-full flex items-center justify-center text-white text-sm">
                              ✓
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 flex justify-between items-center bg-[#1e1e1e]">
          <div>
            {selectedDish && (
              <p className="text-sm text-gray-400">
                {t('orderEdit.selected')}: <span className="text-[#6FB92D] font-medium">{selectedDish.name}</span>
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-full transition-colors font-medium"
            >
              {t('app.cancel')}
            </button>
            <button
              onClick={handleOrder}
              disabled={!selectedDish || isActionLoading}
              className="px-6 py-2.5 bg-[#6FB92D] hover:bg-[#5da025] text-white rounded-full shadow-lg disabled:opacity-50 disabled:cursor-not-allowed font-bold transition-all flex items-center gap-2"
            >
              {placeOrderMutation.isPending ? (
                <>
                  <span className="animate-spin">⏳</span>
                  {slot.currentOrder ? t('orderEdit.changing') : t('orderEdit.ordering')}
                </>
              ) : (
                slot.currentOrder ? t('orderEdit.changeDish') : t('orderEdit.confirmOrder')
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default OrderEditModal;
