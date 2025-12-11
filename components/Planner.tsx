import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DailyStatus, PlannedOrder, UserPreferences } from '../types';
import { GeminiService } from '../services/geminiService';
import { getAvailableDishes, placeOrder, fetchOrderHistory, getAddresses, Address } from '../services/meicanService';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  weekStatus: DailyStatus[];
  prefs: UserPreferences;
  onUpdatePrefs: (prefs: UserPreferences) => void;
  onOrdersPlaced: () => void;
  onCancel: () => void;
}

type Step = 'idle' | 'fetching' | 'planning' | 'review' | 'submitting' | 'error' | 'completed' | 'ai_config' | 'fully_planned';

interface OrderResult {
  date: string;
  dishName: string;
  success: boolean;
  message?: string;
}

type TimelineStep = 'initializing' | 'fetchingMenus' | 'analyzingHistory' | 'generatingPlan' | 'planReady';

const TimelineProgress: React.FC<{ 
  currentStep: TimelineStep; 
  progress?: { current: number; total: number; historyCount?: number } 
}> = ({ currentStep, progress }) => {
  const { t } = useTranslation();
  
  const steps: { key: TimelineStep; icon: string }[] = [
      { key: 'initializing', icon: '⚡' },
      { key: 'fetchingMenus', icon: '🍽️' },
      { key: 'analyzingHistory', icon: '🔎' },
      { key: 'generatingPlan', icon: '✨' }
  ];

  const currentIndex = currentStep === 'planReady' 
    ? steps.length 
    : steps.findIndex(s => s.key === currentStep);

  return (
      <div className="w-full max-w-md mx-auto py-10">
          <div className="relative">
              {/* Vertical Line */}
              <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-[#333]"></div>
              
              <div className="space-y-8 relative">
                  {steps.map((s, idx) => {
                      const isActive = idx === currentIndex;
                      const isCompleted = idx < currentIndex;
                      const isPending = idx > currentIndex;

                      return (
                          <div key={s.key} className={`flex items-start transition-all duration-300 ${isPending ? 'opacity-30' : 'opacity-100'}`}>
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 z-10 border-2 transition-all duration-500
                                  ${isActive ? 'bg-[#6FB92D]/20 border-[#6FB92D] text-2xl scale-110 shadow-[0_0_15px_rgba(111,185,45,0.4)]' : ''}
                                  ${isCompleted ? 'bg-[#6FB92D] border-[#6FB92D] text-white' : ''}
                                  ${isPending ? 'bg-[#2A2A2A] border-[#444] text-gray-500' : ''}
                              `}>
                                  {isCompleted ? '✓' : isActive ? (
                                      <motion.div
                                          animate={{ rotate: 360 }}
                                          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                                      >
                                          {s.icon}
                                      </motion.div>
                                  ) : s.icon}
                              </div>
                              <div className="ml-4 pt-1">
                                  <h4 className={`text-lg font-bold transition-colors ${isActive ? 'text-white' : 'text-gray-400'}`}>
                                      {t(`planner.steps.${s.key}`)}
                                  </h4>
                                  {isActive && (
                                      <motion.p 
                                          initial={{ opacity: 0, x: -10 }}
                                          animate={{ opacity: 1, x: 0 }}
                                          className="text-sm text-[#6FB92D] mt-1"
                                      >
                                          {t(`planner.stepDetails.${s.key}`, { 
                                              current: progress?.current, 
                                              total: progress?.total,
                                              count: progress?.historyCount 
                                          })}
                                      </motion.p>
                                  )}
                              </div>
                          </div>
                      )
                  })}
              </div>
          </div>
      </div>
  );
};

const Planner: React.FC<Props> = ({ weekStatus, prefs, onUpdatePrefs, onOrdersPlaced, onCancel }) => {
  const { t } = useTranslation();
  // Identify slots that need ordering
  const slotsToFill = useMemo(() => {
    return weekStatus.filter(s => {
      const dayOfWeek = new Date(s.date).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday = 0, Saturday = 6
      
      // Filter by weekend preference
      if (isWeekend && !prefs.enableWeekends) return false;

      // Filter by breakfast preference
      if (s.mealTime === 'BREAKFAST') return false;

      return s.status === 'AVAILABLE' || s.status === 'NO_SERVICE';
    });
  }, [weekStatus, prefs]);

  // Initial step depends on availability
  const [step, setStep] = useState<Step>(() => {
      // If no slots to fill, show specific UI
      if (slotsToFill.length === 0) return 'fully_planned';
      return 'idle';
  });

  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<PlannedOrder[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [orderResults, setOrderResults] = useState<OrderResult[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  
  // Timeline State
  const [timelineStep, setTimelineStep] = useState<TimelineStep>('initializing');
  const [fetchProgress, setFetchProgress] = useState({ current: 0, total: 0, historyCount: 0 });

  // Local state for AI Config
  const [configForm, setConfigForm] = useState<Partial<UserPreferences>>({});

  // Auto-switch between idle and fully_planned when slots change (e.g. via prefs)
  useEffect(() => {
      if (step === 'idle' && slotsToFill.length === 0) {
          setStep('fully_planned');
      } else if (step === 'fully_planned' && slotsToFill.length > 0) {
          setStep('idle');
      }
  }, [slotsToFill.length, step]);

  const addLog = (msg: string) => {
    console.log(`[Planner] ${msg}`);
    // Only keep last 50 logs to prevent overflow/performance issues
    setLogs(prev => [...prev.slice(-49), msg]);
  };

  const handleError = (error: any, customMsg: string) => {
    console.error(error);
    setErrorMsg(customMsg || error.message || t('planner.unknownError'));
    setStep('error');
    setLoading(false);
  };

  const checkAIConfig = (): boolean => {
    // If Custom AI is selected, we MUST have URL and Key
    if (prefs.aiProvider === 'custom') {
        if (!prefs.customAiBaseUrl || !prefs.customAiApiKey) {
            setConfigForm(prefs); // Preheat form
            setStep('ai_config');
            setLoading(false);
            return false;
        }
    } else {
        // Gemini: Now MANDATORY per user request
        if (!prefs.geminiApiKey) {
             setConfigForm(prefs);
             setStep('ai_config');
             setLoading(false);
             return false;
        }
    }
    return true;
  };
  
  const saveAiConfig = async () => {
      const newPrefs = { ...prefs, ...configForm };
      onUpdatePrefs(newPrefs);
      // After save, we go to idle (or back to whatever flow). 
      // If slots are present, user can click Generate again.
      setStep('idle'); 
  };

  const startPlanning = async () => {
    setLoading(true);
    setErrorMsg(null);
    setLogs([]);
    addLog(t('planner.analyzing'));
    
    // 0. Check AI Config
    if (!checkAIConfig()) return;

    // 1. Double check slots
    if (slotsToFill.length === 0) {
        setStep('fully_planned');
        setLoading(false);
        return;
    }

    setStep('fetching');
    setTimelineStep('initializing');
    setFetchProgress({ current: 0, total: slotsToFill.length, historyCount: 0 });

    try {
      // 2. Fetch Menus
      setTimelineStep('fetchingMenus');
      const enrichedSlots = [];
      let fetchedCount = 0;

      for (const slot of slotsToFill) {
        if (slot.tabUniqueId) {
          addLog(t('planner.fetchingMenu', { date: slot.date, meal: slot.mealTime }));
          
          let targetTime = "09:00";
          if (slot.mealTime === 'BREAKFAST') targetTime = "07:00";
          if (slot.mealTime === 'DINNER') targetTime = "12:00";
  
          try {
            const menu = await getAvailableDishes(slot.tabUniqueId, `${slot.date} ${targetTime}`, prefs);
            if (menu.length > 0) {
              enrichedSlots.push({ ...slot, menu, tabUniqueId: slot.tabUniqueId! });
            } else {
                addLog(t('planner.noMenuFound', { date: slot.date }));
            }
          } catch (e) {
             addLog(t('planner.fetchMenuFailed', { date: slot.date, error: e }));
          }
        }
        fetchedCount++;
        setFetchProgress(prev => ({ ...prev, current: fetchedCount }));
      }

      if (enrichedSlots.length === 0) {
          throw new Error(t('planner.noMenusFound'));
      }
  
      // 3. Fetch History
      setTimelineStep('analyzingHistory');
      addLog(t('planner.fetchHistory'));
      const today = new Date();
      const fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(today.getDate() - 28);
      
      let history = [];
      try {
        history = await fetchOrderHistory(fourWeeksAgo, today, prefs);
        addLog(t('planner.gotHistory', { count: history.length }));
        setFetchProgress(prev => ({ ...prev, historyCount: history.length }));
      } catch (e) {
        addLog(t('planner.fetchHistoryFailed'));
      }
  
      // 4. AI Generation
      setStep('planning'); // Ensure we are in planning view (which we share with fetching now really)
      setTimelineStep('generatingPlan');
      addLog(t('planner.generating'));
      const aiService = new GeminiService();
      const generatedPlan = await aiService.generateWeeklyPlan(enrichedSlots, history, prefs);
      
      if (!generatedPlan || generatedPlan.length === 0) {
        throw new Error(t('planner.aiGenFailed'));
      }

      setPlan(generatedPlan);
      
      // 5. Show completion on timeline before switching
      setTimelineStep('planReady');
      await new Promise(resolve => setTimeout(resolve, 1000));

      setStep('review');
    } catch (err: any) {
      handleError(err, err.message);
    } finally {
      if (step !== 'ai_config') setLoading(false);
    }
  };

  const executeOrder = async () => {
    setStep('submitting');
    setLoading(true);
    setOrderResults([]);
    
    // Cache for addresses per namespace
    const addressCache: Record<string, { addresses: Address[]; defaultAddressId?: string }> = {};

    const getAddressesForNamespace = async (namespace?: string) => {
      const key = namespace || 'default';
      if (!addressCache[key]) {
        try {
          addressCache[key] = await getAddresses(prefs, namespace);
        } catch (e) {
          console.error(`Failed to fetch addresses for namespace ${namespace}:`, e);
          addressCache[key] = { addresses: [] };
        }
      }
      return addressCache[key];
    };

    // 1. Resolve global default address name if possible
    let defaultAddressName: string | undefined;
    if (prefs.defaultAddressId) {
        // Try sample namespace
        const sampleNamespace = plan.find(i => i.namespace)?.namespace;
        const result = await getAddressesForNamespace(sampleNamespace);
        const addr = result.addresses.find(a => a.uniqueId === prefs.defaultAddressId);
        if (addr) defaultAddressName = addr.name;
    } 
    
    // Also try to find a name from existing orders if we still don't have one
    if (!defaultAddressName) {
         const existingOrderWithAddress = weekStatus.find(s => s.userAddressUniqueId);
         if (existingOrderWithAddress?.userAddressUniqueId) {
             const result = await getAddressesForNamespace(existingOrderWithAddress.namespace);
             const addr = result.addresses.find(a => a.uniqueId === existingOrderWithAddress.userAddressUniqueId);
             if (addr) defaultAddressName = addr.name;
         }
    }

    const results: OrderResult[] = [];

    // 2. Execute
    for (const item of plan) {
      addLog(t('planner.orderingItem', { dish: item.dish.name, date: item.date }));
      
      let error: string | undefined;
      let addressIdToUse = item.userAddressUniqueId;

      try {
        if (!addressIdToUse) {
            const result = await getAddressesForNamespace(item.namespace);
            
            // Match by name
            if (defaultAddressName) {
                const matched = result.addresses.find(a => a.name === defaultAddressName);
                if (matched) addressIdToUse = matched.uniqueId;
            }
            
            // Fallback
            if (!addressIdToUse && result.addresses.length > 0) {
                addressIdToUse = result.defaultAddressId || result.addresses[0].uniqueId;
                if (!defaultAddressName) defaultAddressName = result.addresses[0].name; // Learn detailed name
            }
        }

        if (!addressIdToUse) {
            throw new Error(`No valid address found for namespace ${item.namespace || 'unknown'}`);
        }

        let targetTime = "09:00";
        if (item.mealTime === 'BREAKFAST') targetTime = "07:00";
        if (item.mealTime === 'DINNER') targetTime = "12:00";

        await placeOrder(item.tabUniqueId, item.dish.id, `${item.date} ${targetTime}`, prefs, addressIdToUse);
        addLog(t('planner.orderSuccess', { date: item.date }));
      } catch (e: any) {
        error = e.message || t('planner.unknownError');
        addLog(t('planner.orderFailed', { date: item.date, error: error }));
      }

      results.push({
        date: item.date,
        dishName: item.dish.name,
        success: !error,
        message: error
      });
    }

    setOrderResults(results);
    setStep('completed');
    setLoading(false);
  };

  const removePlanItem = (index: number) => {
    setPlan(prev => prev.filter((_, i) => i !== index));
  };

  const retry = () => {
    setStep('idle');
    setErrorMsg(null);
  };

  const completedSuccessCount = orderResults.filter(r => r.success).length;
  const completedFailCount = orderResults.filter(r => !r.success).length;

  return (
    <AnimatePresence>
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
        className="bg-[#252525] rounded-3xl shadow-2xl p-8 w-full max-w-3xl max-h-[90vh] flex flex-col border border-white/10"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center">
            <span className="text-[#6FB92D] mr-2">AI</span> {t('planner.title').replace('AI ', '')}
          </h2>
          {step !== 'submitting' && step !== 'completed' && (
             <button onClick={onCancel} className="text-gray-400 hover:text-white transition-colors text-xl">✕</button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto min-h-[300px] pr-2 custom-scrollbar relative">
          
          {/* IDLE / START */}
          {step === 'idle' && (
             <div className="text-center py-20 flex flex-col items-center">
                <div className="w-24 h-24 bg-[#2A2A2A] rounded-full flex items-center justify-center mb-6 shadow-xl border border-[#333]">
                    <span className="text-4xl">🪄</span>
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">{t('planner.readyTitle')}</h3>
                <p className="text-gray-400 mb-8 max-w-md">{t('planner.readyDesc')}</p>
                
                {slotsToFill.length > 0 && (
                    <div className="flex items-center space-x-2 text-sm text-gray-500 mb-6 bg-[#1e1e1e] px-4 py-2 rounded-lg border border-[#333]">
                        <span className="w-2 h-2 rounded-full bg-[#6FB92D]"></span>
                        <span>{slotsToFill.length} {t('planner.mealsToPlan')}</span>
                    </div>
                )}
                
                <button 
                    onClick={startPlanning} 
                    className="bg-[#6FB92D] text-white px-10 py-4 rounded-full shadow-[0_10px_30px_rgba(111,185,45,0.3)] hover:bg-[#5da025] font-bold text-lg hover:scale-105 transition-all"
                >
                    {t('planner.generateBtn')}
                </button>
            </div>
          )}
          
          {/* FULLY PLANNED */}
          {step === 'fully_planned' && (
             <div className="text-center py-24 flex flex-col items-center">
                <div className="w-24 h-24 bg-[#6FB92D]/10 rounded-full flex items-center justify-center mb-6 shadow-xl border border-[#6FB92D]/20">
                    <span className="text-4xl">🎉</span>
                </div>
                 <h3 className="text-2xl font-bold text-white mb-2">{t('planner.allSetTitle')}</h3>
                <p className="text-gray-400 mb-8 max-w-md">
                    {t('planner.allSetDesc')} 
                    <br/><span className="text-sm opacity-70 mt-2 block">{t('planner.basedOnSettings')}</span>
                </p>
                
                {!prefs.enableWeekends && (
                    <div className="mb-8 p-4 bg-[#2A2A2A] rounded-xl border border-[#333] max-w-sm text-sm text-gray-400">
                        <span className="block mb-2 text-white font-bold">{t('planner.tip')}</span>
                        {t('planner.weekendTip')} <span className="text-white bg-[#333] px-1 rounded">{t('app.settings')}</span>.
                    </div>
                )}
                
                <button 
                    onClick={onCancel} 
                    className="bg-white text-black px-10 py-3 rounded-full hover:bg-gray-100 font-bold text-lg transition-all"
                >
                    {t('planner.closePlanner')}
                </button>
            </div>
          )}

          {/* AI CONFIG */}
          {step === 'ai_config' && (
              <div className="flex flex-col items-center justify-center py-10 space-y-6">
                 <div className="w-16 h-16 bg-[#6FB92D]/20 rounded-full flex items-center justify-center text-3xl mb-2">
                     ⚙️
                 </div>
                  <h3 className="text-2xl font-bold text-white">{t('planner.configRequired')}</h3>
                  <p className="text-gray-400 max-w-md text-center">
                      {t('planner.configDesc')}
                  </p>
                 
                 <div className="w-full max-w-lg bg-[#181818] rounded-xl p-6 border border-[#333] space-y-4">
                     <div>
                         <label className="block text-sm font-medium text-gray-400 mb-1">{t('settings.aiProvider')}</label>
                        <select 
                          value={configForm.aiProvider || prefs.aiProvider || 'gemini'}
                          onChange={(e) => setConfigForm(prev => ({ ...prev, aiProvider: e.target.value as any }))}
                          className="w-full rounded-lg border border-[#444] bg-[#252525] p-2.5 text-white focus:border-[#6FB92D] outline-none"
                        >
                          <option value="gemini">{t('settings.geminiDefault')}</option>
                          <option value="custom">{t('settings.customAi')}</option>
                        </select>
                     </div>
                     
                     {(configForm.aiProvider || prefs.aiProvider) === 'custom' ? (
                        <>
                             <div>
                                 <label className="block text-sm font-medium text-gray-400 mb-1">{t('settings.baseUrl')}</label>
                                <input 
                                  type="text"
                                  value={configForm.customAiBaseUrl || ''}
                                  onChange={(e) => setConfigForm(prev => ({ ...prev, customAiBaseUrl: e.target.value }))}
                                  className="w-full rounded-lg border border-[#444] bg-[#252525] p-2.5 text-white focus:border-[#6FB92D] outline-none"
                                  placeholder="https://api.openai.com/v1"
                                />
                              </div>
                              <div>
                                 <label className="block text-sm font-medium text-gray-400 mb-1">{t('settings.apiKey')}</label>
                                <input 
                                  type="password"
                                  value={configForm.customAiApiKey || ''}
                                  onChange={(e) => setConfigForm(prev => ({ ...prev, customAiApiKey: e.target.value }))}
                                  className="w-full rounded-lg border border-[#444] bg-[#252525] p-2.5 text-white focus:border-[#6FB92D] outline-none"
                                  placeholder="sk-..."
                                />
                              </div>
                              <div>
                                 <label className="block text-sm font-medium text-gray-400 mb-1">{t('settings.modelName')}</label>
                                <input 
                                  type="text"
                                  value={configForm.customAiModel || ''}
                                  onChange={(e) => setConfigForm(prev => ({ ...prev, customAiModel: e.target.value }))}
                                  className="w-full rounded-lg border border-[#444] bg-[#252525] p-2.5 text-white focus:border-[#6FB92D] outline-none"
                                  placeholder="gpt-4o"
                                />
                              </div>
                         </>
                     ) : (
                        <div>
                              <label className="block text-sm font-medium text-gray-400 mb-1">{t('settings.geminiApiKey')}</label>
                             <input 
                               type="password"
                               value={configForm.geminiApiKey || ''}
                               onChange={(e) => setConfigForm(prev => ({ ...prev, geminiApiKey: e.target.value }))}
                               className="w-full rounded-lg border border-[#444] bg-[#252525] p-2.5 text-white focus:border-[#6FB92D] outline-none"
                               placeholder="Enter Gemini API Key"
                             />
                        </div>
                     )}
                 </div>
                                  <div className="flex space-x-4 pt-4">
                      <button onClick={onCancel} className="px-6 py-2.5 text-gray-400 hover:text-white font-medium">{t('app.cancel')}</button>
                      <button 
                         onClick={saveAiConfig} 
                         disabled={
                             (configForm.aiProvider === 'custom' || prefs.aiProvider === 'custom') 
                                ? (!configForm.customAiApiKey || !configForm.customAiBaseUrl)
                                : !configForm.geminiApiKey
                         }
                         className="px-8 py-2.5 bg-[#6FB92D] text-white rounded-full font-bold hover:bg-[#5da025] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                     >
                          {t('planner.saveAndContinue')}
                      </button>
                 </div>
              </div>
          )}

          {/* LOADING STATES WITH TIMELINE */}
          {(step === 'fetching' || step === 'planning') && (
            <motion.div 
               key="timeline"
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -10 }}
               transition={{ duration: 0.3 }}
               className="flex flex-col items-center justify-start h-full space-y-4 pt-4"
            >
              <TimelineProgress currentStep={timelineStep} progress={fetchProgress} />
              
              <div className="w-full max-w-lg mt-4">
                <button 
                  onClick={() => setShowLogs(!showLogs)}
                  className="text-xs text-gray-500 hover:text-white mb-2 flex items-center justify-center w-full"
                >
                    {showLogs ? t('planner.hideLogs') : t('planner.showDetails')}
                </button>
                {showLogs && (
                    <div className="bg-[#181818] rounded-xl p-4 text-xs font-mono text-gray-500 h-32 overflow-y-auto border border-[#333]">
                        {logs.map((l, i) => <div key={i} className="mb-1">{l}</div>)}
                    </div>
                )}
              </div>
            </motion.div>
          )}

          {/* SUBMITTING STATE (Simple Spinner) */}
          {step === 'submitting' && (
            <div className="flex flex-col items-center justify-center h-full space-y-6 py-12">
               {/* Keep existing spinner for submitting */}
               <div className="relative">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#6FB92D]"></div>
                <div className="absolute inset-0 flex items-center justify-center text-[#6FB92D] opacity-20 text-2xl">⚡</div>
              </div>
              <div className="text-center">
                  <h3 className="text-xl font-bold text-white mb-1">Submitting...</h3>
                  <p className="text-gray-400 text-sm">{t('planner.processing')}</p>
              </div>
               
               <div className="w-full max-w-lg mt-8">
                    <div className="bg-[#181818] rounded-xl p-4 text-xs font-mono text-gray-500 h-40 overflow-y-auto border border-[#333]">
                        {logs.map((l, i) => <div key={i} className="mb-1">{l}</div>)}
                    </div>
               </div>
            </div>
          )}

          {/* ERROR STATE */}
          {step === 'error' && (
            <div className="flex flex-col items-center justify-center h-full space-y-6 py-10">
                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/20 mb-2">
                    <span className="text-4xl">⚠️</span>
                </div>
                <h3 className="text-2xl font-bold text-white">{t('planner.planningFailed')}</h3>
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 max-w-lg text-center">
                    <p className="text-red-200">{errorMsg}</p>
                </div>
                <div className="flex space-x-4 mt-4">
                    <button onClick={onCancel} className="px-6 py-2.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-full transition-colors font-medium">
                        {t('app.cancel')}
                    </button>
                    <button onClick={retry} className="px-8 py-2.5 bg-white text-black rounded-full hover:bg-gray-100 font-bold">
                        {t('planner.tryAgain')}
                    </button>
                </div>
                 <div className="w-full max-w-lg mt-8">
                      <div className="text-xs text-gray-500 mb-2 uppercase tracking-wider font-bold text-center">{t('planner.diagnostics')}</div>
                    <div className="bg-[#181818] rounded-xl p-4 text-xs font-mono text-gray-500 h-32 overflow-y-auto border border-[#333]">
                        {logs.map((l, i) => <div key={i} className="mb-1">{l}</div>)}
                    </div>
                 </div>
            </div>
          )}

          {/* REVIEW STATE */}
          {step === 'review' && (
            <motion.div 
               key="review"
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ duration: 0.5, type: "spring" }}
               className="space-y-6"
            >
              <div className="bg-[#6FB92D]/10 border border-[#6FB92D]/20 p-5 rounded-2xl text-[#6FB92D] text-sm flex items-start">
                 <span className="text-xl mr-3">💡</span>
                 <span>
                     {t('planner.generatedPlanPrefix')} <strong className="text-white capitalize">{prefs.planningMode}</strong> {t('planner.generatedPlanSuffix')}
                     {t('planner.reviewItems')}
                 </span>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {plan.map((item, idx) => (
                  <div key={idx} className="bg-[#2A2A2A] border border-[#333] rounded-2xl p-5 flex justify-between items-start hover:border-[#6FB92D]/40 transition-all group shadow-sm">
                    <div>
                      <div className="flex items-center space-x-3 mb-2">
                        <span className="font-bold text-white bg-[#333] px-3 py-1 rounded-lg text-sm">{item.date}</span>
                        <span className="text-xs font-bold px-2 py-1 rounded bg-[#181818] text-gray-400 border border-[#333]">{item.mealTime}</span>
                        <span className="text-xs text-[#6FB92D] font-medium px-2 py-1 bg-[#6FB92D]/10 rounded border border-[#6FB92D]/20">
                          {item.dish.restaurantName}
                        </span>
                      </div>
                      <h4 className="text-lg font-bold text-gray-200 group-hover:text-[#6FB92D] transition-colors">{item.dish.name}</h4>
                      <p className="text-xs text-gray-500 mt-2 italic flex items-center">
                        <span className="w-1 h-1 bg-gray-500 rounded-full mr-2"></span>
                        {item.reason}
                      </p>
                    </div>
                    <div className="flex flex-col items-end space-y-3">
                      <span className="font-mono text-xl text-white">¥{(item.dish.priceInCent / 100).toFixed(2)}</span>
                      <button 
                        onClick={() => removePlanItem(idx)}
                        className="text-gray-500 text-xs hover:text-red-400 transition-colors uppercase tracking-wide font-bold"
                      >
                        {t('planner.remove')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {plan.length === 0 && <div className="text-center text-gray-500 py-20 bg-[#1e1e1e] rounded-2xl border-2 border-dashed border-[#333]">{t('planner.noItems')}</div>}
            </motion.div>
          )}

          {/* COMPLETED STATE */}
          {step === 'completed' && (
             <div className="text-center py-12 flex flex-col items-center">
                 <div className="w-20 h-20 bg-[#6FB92D]/10 rounded-full flex items-center justify-center border border-[#6FB92D]/20 mb-4">
                    <span className="text-4xl">✅</span>
                 </div>
                  <h3 className="text-2xl font-bold text-white mb-2">{t('planner.allDone')}</h3>
                  <p className="text-gray-400 mb-8 max-w-md">
                    {t('planner.successCount')} <strong className="text-white">{orderResults.filter(r => r.success).length}</strong> {t('planner.orders')}
                    {orderResults.some(r => !r.success) && <span className="text-red-400 ml-1">({orderResults.filter(r => !r.success).length} {t('planner.failures')})</span>}
                  </p>
                 
                 <div className="w-full max-w-xl bg-[#2A2A2A] rounded-2xl border border-[#333] overflow-hidden mb-8">
                    <div className="max-h-[300px] overflow-y-auto">
                        {orderResults.map((res, i) => (
                            <div key={i} className={`p-4 border-b border-[#333] flex justify-between items-center ${!res.success ? 'bg-red-500/5' : ''}`}>
                                <div className="text-left">
                                    <div className="text-sm font-bold text-white">{res.date}</div>
                                    <div className="text-xs text-gray-400">{res.dishName}</div>
                                    {!res.success && <div className="text-xs text-red-400 mt-1">{res.message}</div>}
                                </div>
                                <div>
                                    {res.success ? (
                                        <span className="px-3 py-1 bg-[#6FB92D]/20 text-[#6FB92D] text-xs rounded-full font-bold border border-[#6FB92D]/30">Success</span>
                                    ) : (
                                        <span className="px-3 py-1 bg-red-500/20 text-red-400 text-xs rounded-full font-bold border border-red-500/30">Failed</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                 </div>

                 <button 
                    onClick={onOrdersPlaced} 
                    className="bg-[#6FB92D] text-white px-10 py-3 rounded-full hover:bg-[#5da025] font-bold text-lg shadow-[0_10px_30px_rgba(111,185,45,0.3)] transition-all"
                 >
                    {t('planner.closeAndRefresh')}
                 </button>
             </div>
          )}
        </div>

        {/* FOOTER ACTIONS - Only for Review Step */}
        {step === 'review' && (
             <div className="mt-8 pt-4 border-t border-white/5 flex justify-end space-x-4">
               <button onClick={startPlanning} className="px-6 py-2.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-full transition-colors font-medium">{t('planner.regenerate')}</button>
               <button 
                 onClick={executeOrder} 
                 className="px-8 py-2.5 bg-white text-black rounded-full shadow hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed font-bold transition-colors"
                 disabled={plan.length === 0}
               >
                  {t('planner.confirmAndPlace')}
               </button>
             </div>
        )}
      </motion.div>
    </motion.div>
    </AnimatePresence>
  );
};

export default Planner;