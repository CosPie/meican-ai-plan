import React, { useState, useEffect, useRef } from 'react';
import { formatDate } from './utils/dateUtils';
import { useTranslation } from 'react-i18next';
import { UserPreferences, DailyStatus, OrderStatus } from './types';
import { getPreferences, savePreferences } from './services/db';
import { useCalendarStatus, useLogout } from './hooks/useMeican';
import { getSettings } from './services/meicanService';
import SettingsPanel from './components/SettingsPanel';
import Planner from './components/Planner';
import AnalysisPanel from './components/AnalysisPanel';
import OrderEditModal from './components/OrderEditModal';
import LandingPage from './components/LandingPage';
import { motion, AnimatePresence } from 'framer-motion';

const DEFAULT_PREFS: UserPreferences = {
  username: '',
  password: '',
  sessionId: '',
  proxyUrl: '',
  useMockData: false,
  excludedKeywords: [],
  vendorWeights: {},
  planningMode: 'balanced',
  aiProvider: 'gemini',
  geminiApiKey: '',
  customAiBaseUrl: '',
  customAiApiKey: '',
  customAiModel: ''
};

// Skeleton component for loading state
const MealSkeleton: React.FC<{ color: string }> = ({ color }) => (
  <div className="w-full animate-pulse">
    <div className={`h-4 ${color} rounded-lg w-3/4 mb-2`}></div>
    <div className={`h-3 bg-gray-700 rounded w-1/2`}></div>
  </div>
);

const App: React.FC = () => {
  const { t } = useTranslation();
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showPlanner, setShowPlanner] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [editingSlot, setEditingSlot] = useState<DailyStatus | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const logoutMutation = useLogout();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    d.setDate(diff);
    return d;
  });

  // Calculate start and end dates for the current week
  const getWeekRange = (baseDate: Date) => {
    const start = new Date(baseDate);
    // Align to Monday
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    
    const end = new Date(start);
    // If weekends are enabled, show until Sunday (6 days after Monday)
    // If weekends are disabled, show until Friday (4 days after Monday)
    const daysToAdd = prefs?.enableWeekends ? 6 : 4;
    end.setDate(end.getDate() + daysToAdd);
    return { start, end };
  };

  const { start: weekStart, end: weekEnd } = getWeekRange(currentWeekStart);
  
  const { data: weekStatus = [], isLoading, isFetching, refetch: refetchCalendar } = useCalendarStatus(weekStart, weekEnd, prefs);

  useEffect(() => {
    // Initial Load
    getPreferences().then(async (stored) => {
      let initial = stored || DEFAULT_PREFS;
      
      // If logged in, fetch latest settings from backend
      if (initial.sessionId && initial.username) {
        try {
          const backendSettings = await getSettings(initial.username);
          if (backendSettings) {
            initial = { ...initial, ...backendSettings };
            // Update local storage with latest backend settings
            await savePreferences(initial);
          }
        } catch (e) {
          console.error('Failed to sync settings:', e);
        }
      }
      
      setPrefs(initial);
    });
  }, []);

  const handleWeekChange = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeekStart(newDate);
  };

  const handleLogout = async () => {
    if (prefs) {
      try {
        await logoutMutation.mutateAsync(prefs);
      } catch (e) {
        console.error('Logout failed:', e);
      }
      const newPrefs = { ...prefs, sessionId: '' };
      await savePreferences(newPrefs);
      setPrefs(newPrefs);
      setShowUserMenu(false);
    }
  };

  const [loadingSlotId, setLoadingSlotId] = useState<string | null>(null);

  // Check if a slot can still be edited (modification deadline not passed)
  const canEditSlot = (slot: DailyStatus | undefined): boolean => {
    if (!slot) return false;
    if (slot.status === OrderStatus.CLOSED) return false;
    
    if (!slot.closeTime) return true; // If no closeTime, assume it's editable
    
    // closeTime could be either "HH:mm" or "YYYY-MM-DD HH:mm" format
    let closeDate: Date;
    if (slot.closeTime.includes('-')) {
      closeDate = new Date(slot.closeTime.replace(' ', 'T'));
    } else {
      closeDate = new Date(`${slot.date}T${slot.closeTime}`);
    }
    
    return new Date() < closeDate;
  };

  if (!prefs) return <div className="flex h-screen items-center justify-center bg-[#181818] text-[#6FB92D]">{t('app.loading')}</div>;

  // Determine if we should show the Landing Page
  const showLanding = !prefs.sessionId && !prefs.useMockData;

  return (
    <div className="min-h-screen text-gray-200 font-sans selection:bg-[#6FB92D] selection:text-white bg-[#181818]">
      <AnimatePresence mode="wait">
        {showLanding ? (
           <motion.div
             key="landing"
             exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
             transition={{ duration: 0.5 }}
           >
             <LandingPage 
               initialPrefs={prefs}
               onLoginSuccess={(newPrefs) => setPrefs(newPrefs)}
             />
           </motion.div>
        ) : (
          <motion.div
             key="main"
             initial={{ opacity: 0, scale: 1.05 }}
             animate={{ opacity: 1, scale: 1 }}
             transition={{ duration: 0.8, ease: "circOut" }}
             className="min-h-screen"
          >
            {/* Header */}
            <motion.header 
              initial={{ y: -100 }}
              animate={{ y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.3 }}
              className="fixed top-0 w-full z-20 glass-panel border-b-0 shadow-lg shadow-black/20"
            >
              <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 md:h-20 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <motion.div 
                    whileHover={{ rotate: 10, scale: 1.1 }}
                    className="w-10 h-10 bg-[#6FB92D] text-white font-bold rounded-xl flex items-center justify-center text-xl shadow-[0_0_15px_rgba(111,185,45,0.4)]"
                  >
                    M
                  </motion.div>
                  <h1 className="text-lg md:text-xl font-bold tracking-tight">{t('app.title', { highlight: 'AI' }).split('AI')[0]}<span className="text-[#6FB92D]">AI</span>{t('app.title', { highlight: 'AI' }).split('AI')[1]}</h1>
                </div>
                <div className="flex items-center space-x-6">
                  <button 
                    onClick={() => setShowAnalysis(true)}
                    className="text-sm font-medium text-gray-400 hover:text-[#6FB92D] transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                    <span className="hidden sm:inline">{t('app.analysis')}</span>
                  </button>
                  <button 
                    onClick={() => setShowSettings(true)}
                    className="text-sm font-medium text-gray-400 hover:text-[#6FB92D] transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    <span className="hidden sm:inline">{t('app.settings')}</span>
                  </button>
                  <div className="relative group">
                    <motion.button 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowUserMenu(!showUserMenu)}
                      className="h-9 w-9 rounded-full bg-[#6FB92D]/20 flex items-center justify-center text-[#6FB92D] font-bold border border-[#6FB92D]/30 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#6FB92D]/50"
                    >
                      {prefs.username ? prefs.username.charAt(0).toUpperCase() : 'U'}
                    </motion.button>
                    
                    <AnimatePresence>
                      {showUserMenu && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)}></div>
                          <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            transition={{ duration: 0.1 }}
                            className="absolute top-full right-0 mt-2 w-48 bg-[#252525] rounded-xl shadow-xl border border-white/10 overflow-hidden z-50 flex flex-col"
                          >
                            <div className="px-4 py-3 border-b border-white/5">
                              <p className="text-xs text-gray-500">{t('app.signedInAs')}</p>
                              <p className="text-sm font-medium text-white truncate text-ellipsis overflow-hidden">{prefs.username}</p>
                            </div>
                            <button 
                              onClick={handleLogout}
                              className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-red-400/10 transition-colors flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                              {t('app.logout')}
                            </button>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </motion.header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-10 md:py-28">
              
              {/* Controls */}
              <div className="flex flex-col sm:flex-row justify-between items-center mb-6 md:mb-10 gap-4 md:gap-6">
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                  className="flex items-center bg-[#252525] rounded-full shadow-lg p-1 border border-white/5"
                >
                  <button onClick={() => handleWeekChange('prev')} className="px-4 py-2 hover:bg-[#333] rounded-full text-gray-400 hover:text-white transition-colors">←</button>
                  <span className="px-6 font-medium text-gray-200">
                    {t('app.weekOf')} <span className="text-[#6FB92D]">{currentWeekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                  </span>
                  <button onClick={() => handleWeekChange('next')} className="px-4 py-2 hover:bg-[#333] rounded-full text-gray-400 hover:text-white transition-colors">→</button>
                </motion.div>
                
                <motion.button 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ delay: 0.6 }}
                  onClick={() => setShowPlanner(true)}
                  className="group flex items-center bg-[#6FB92D] hover:bg-[#5da025] text-white px-8 py-3 rounded-full shadow-[0_4px_20px_rgba(111,185,45,0.3)] transition-all"
                >
                  <span className="text-xl mr-2 group-hover:rotate-12 transition-transform">✨</span> 
                  <span className="font-semibold">{t('app.aiAutoPlan')}</span>
                </motion.button>
              </div>

              {/* Calendar Grid */}
              <motion.div 
                className="grid grid-cols-1 md:grid-cols-5 gap-6"
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: { opacity: 0 },
                  visible: {
                    opacity: 1,
                    transition: {
                      staggerChildren: 0.1,
                      delayChildren: 0.4
                    }
                  }
                }}
              >
                {(prefs.enableWeekends 
                  ? ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
                  : ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
                 ).map((dayKey, idx) => {
                   const dayName = t(`days.${dayKey}`);
                   // Basic date math to find the date string for this column
                   const d = new Date(currentWeekStart);
                   const day = d.getDay();
                   const diff = d.getDate() - day + (day === 0 ? -6 : 1) + idx;
                   d.setDate(diff);
                   const dateStr = formatDate(d);
                   
                   const dayItems = weekStatus.filter(w => w.date === dateStr);
                   const isToday = formatDate(new Date()) === dateStr;
                   
                   // Define meals based on preferences
                   const mealsToShow = [];
                   if (prefs.enableBreakfast) mealsToShow.push({ id: 'BREAKFAST', label: t('meals.breakfast'), color: 'bg-orange-500', text: 'text-orange-400' });
                   mealsToShow.push({ id: 'LUNCH', label: t('meals.lunch'), color: 'bg-[#6FB92D]', text: 'text-[#6FB92D]' });
                   mealsToShow.push({ id: 'DINNER', label: t('meals.dinner'), color: 'bg-indigo-500', text: 'text-indigo-400' });

                   return (
                     <motion.div 
                       key={dayKey} 
                       variants={{
                         hidden: { opacity: 0, y: 20 },
                         visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 30 } }
                       }}
                       className={`glass-panel rounded-3xl overflow-hidden flex flex-col h-[${prefs.enableBreakfast ? '32rem' : '26rem'}] transition-all duration-300 hover:shadow-xl hover:shadow-[#6FB92D]/10 hover:border-[#6FB92D]/30 ${isToday ? 'ring-2 ring-[#6FB92D] ring-offset-2 ring-offset-[#181818]' : ''}`}
                     >
                       <div className="bg-[#2A2A2A]/50 px-5 py-4 border-b border-white/5 flex justify-between items-baseline">
                         <h3 className={`font-bold text-lg ${isToday ? 'text-[#6FB92D]' : 'text-gray-300'}`}>{dayName}</h3>
                       </div>
                       
                       <div className="flex-1 p-4 space-y-4 flex flex-col">
                          {mealsToShow.map(meal => {
                            const mealItem = dayItems.find(i => i.mealTime === meal.id);
                            const isOrdered = mealItem?.status === OrderStatus.ORDERED;
                            const slotKey = mealItem ? `${mealItem.date}-${mealItem.mealTime}` : '';
                            const isSlotLoading = isLoading || (isFetching && loadingSlotId === slotKey);

                            return (
                              <motion.button 
                                key={meal.id}
                                whileHover={canEditSlot(mealItem) && !isSlotLoading ? { scale: 1.02 } : {}}
                                whileTap={canEditSlot(mealItem) && !isSlotLoading ? { scale: 0.98 } : {}}
                                onClick={() => mealItem && canEditSlot(mealItem) && setEditingSlot(mealItem)}
                                disabled={isSlotLoading || !mealItem || !canEditSlot(mealItem)}
                                className={`flex-1 rounded-2xl border-2 border-dashed p-4 flex flex-col justify-center items-center text-center relative transition-all duration-300 group ${
                                isSlotLoading 
                                  ? 'bg-[#1e1e1e] border-[#333] cursor-default'
                                  : !canEditSlot(mealItem)
                                    ? 'bg-[#1e1e1e] border-[#333] cursor-not-allowed opacity-70'
                                    : isOrdered 
                                      ? `${meal.color}/10 border-${meal.color.split('-')[1]}-${meal.color.split('-')[2] || '400'}/40 hover:border-${meal.color.split('-')[1]}-${meal.color.split('-')[2] || '400'} hover:${meal.color}/20 cursor-pointer` 
                                      : 'bg-[#1e1e1e] border-[#333] hover:border-[#6FB92D]/50 hover:bg-[#252525] cursor-pointer'
                              }`}>
                                <span className="absolute top-3 left-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest bg-[#252525] px-2 py-0.5 rounded">{meal.label}</span>
                                {!isSlotLoading && canEditSlot(mealItem) && (
                                  <span className="absolute top-3 right-3 text-[10px] text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">{t('app.clickToEdit')}</span>
                                )}
                                {isSlotLoading ? (
                                  <MealSkeleton color={`${meal.color}/30`} />
                                ) : isOrdered ? (
                                  <div className="w-full">
                                    <div className={`text-sm font-bold ${meal.text} line-clamp-2 mb-1`}>{mealItem.currentOrder?.name || t('app.ordered')}</div>
                                    <div className="text-xs text-gray-400 group-hover:text-gray-200 transition-colors">{mealItem.currentOrder?.restaurantName}</div>
                                  </div>
                                ) : !canEditSlot(mealItem) ? (
                                  <span className="text-sm text-gray-600">{t('app.orderClosed')}</span>
                                ) : (
                                  <span className="text-sm text-gray-600 group-hover:text-gray-400">{t('app.clickToOrder')}</span>
                                )}
                              </motion.button>
                            );
                          })}
                        </div>
                     </motion.div>
                   );
                })}
              </motion.div>
            </main>

            {/* Modals */}
            <AnimatePresence>
              {showSettings && (
                <SettingsPanel 
                  key="settings"
                  initialPrefs={prefs} 
                  onSave={setPrefs} 
                  onClose={() => setShowSettings(false)} 
                />
              )}

              {showPlanner && (
                <Planner 
                  key="planner"
                  weekStatus={weekStatus}
                  prefs={prefs}
                  onUpdatePrefs={async (newPrefs) => {
                    await savePreferences(newPrefs);
                    setPrefs(newPrefs);
                  }}
                  onOrdersPlaced={() => {
                    setShowPlanner(false);
                    refetchCalendar(); // Refresh view
                  }}
                  onCancel={() => setShowPlanner(false)}
                />
              )}

              {showAnalysis && (
                <AnalysisPanel 
                  key="analysis"
                  prefs={prefs}
                  onClose={() => setShowAnalysis(false)}
                />
              )}

              {editingSlot && (
                <OrderEditModal 
                  key="editModal"
                  slot={editingSlot}
                  prefs={prefs}
                  onClose={() => setEditingSlot(null)}
                  onOrderUpdated={() => {
                    setLoadingSlotId(`${editingSlot.date}-${editingSlot.mealTime}`);
                    setEditingSlot(null);
                    refetchCalendar().then(() => setLoadingSlotId(null));
                  }}
                />
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;