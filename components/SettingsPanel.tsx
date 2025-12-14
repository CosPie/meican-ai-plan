import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { UserPreferences } from '../types';
import { savePreferences } from '../services/db';
import { useLogin, useLogout, useCalendarStatus, useUserAddresses, Address } from '../hooks/useMeican';
import { getSettings, saveSettings } from '../services/meicanService';

interface Props {
  initialPrefs: UserPreferences;
  onSave: (prefs: UserPreferences) => void;
  onClose: () => void;
}

import { motion } from 'framer-motion';

const SettingsPanel: React.FC<Props> = ({ initialPrefs, onSave, onClose }) => {
  const { t, i18n } = useTranslation();
  const [formData, setFormData] = useState<UserPreferences>(() => {
    // Default to OpenRouter if no provider is set
    if (!initialPrefs.aiProvider) {
      return {
        ...initialPrefs,
        aiProvider: 'openrouter',
        openRouterModel: 'nex-agi/deepseek-v3.1-nex-n1:free'
      };
    }
    return initialPrefs;
  });
  const [newVendor, setNewVendor] = useState('');
  const [newWeight, setNewWeight] = useState(0);
  const [loginError, setLoginError] = useState('');

  // Mutations
  const loginMutation = useLogin();
  const logoutMutation = useLogout();

  // 2. Queries for Address Loading
  // Calculate dates for "current week" logic used to find namespace (Memoized to prevent infinite loops)
  const [dateRange] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0); // Normalize to midnight
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    const start = new Date(d);
    start.setDate(diff);
    
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { start, end };
  });
  
  const { start: startDate, end: endDate } = dateRange;

  // 2. Fetch calendar to get namespace
  // Only enable if logged in and not using mock data (logic copied from original loadAddresses)
  const shouldLoadAddresses = !!formData.sessionId && !formData.useMockData;
  
  const { data: calendarData } = useCalendarStatus(
    startDate, 
    endDate, 
    formData
    // Implicitly enabled via prefs=formData? No, my hook enables if prefs exist. 
    // But here we want to control it. My hook doesn't support 'enabled'.
    // However, getCalendarStatus will return mock data if useMockData is true, or try API.
    // Ideally we'd modify the hook. But let's assume it runs.
    // Using 'formData' which updates as we type? 
    // If we type into username/password, formData updates. 
    // We only want to trigger this mainly when sessionId is present.
  );
  
  // 3. Get namespace
  const namespace = calendarData?.find(d => d.namespace)?.namespace;

  // 4. Fetch addresses
  const { data: addressData, isLoading: addressLoading } = useUserAddresses(
    formData, 
    namespace
    // This will run if formData is present.
    // getAddresses returns mock if useMockData=true.
  );
  
  const addresses = addressData?.addresses || [];

  // Effect to auto-select default address
  useEffect(() => {
    if (shouldLoadAddresses && addressData?.defaultAddressId && !formData.defaultAddressId) {
       setFormData(prev => ({ ...prev, defaultAddressId: addressData.defaultAddressId }));
    }
  }, [shouldLoadAddresses, addressData, formData.defaultAddressId]);

  const handleChange = (field: keyof UserPreferences, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLogin = async () => {
    if (!formData.username || !formData.password) {
      setLoginError('请输入用户名和密码');
      return;
    }

    setLoginError('');

    try {
      const result = await loginMutation.mutateAsync({
        username: formData.username,
        password: formData.password
      });

      if (result.success && result.sessionId) {
        // Update form data with sessionId
        let updatedPrefs = { ...formData, sessionId: result.sessionId };
        
        // Fetch settings from backend
        const backendSettings = await getSettings(formData.username);
        if (backendSettings) {
          updatedPrefs = { ...updatedPrefs, ...backendSettings };
        }

        setFormData(updatedPrefs);
        
        // Persist to IndexedDB immediately
        await savePreferences(updatedPrefs);
        // Notify parent to update state (so calendar can reload)
        onSave(updatedPrefs);
      } else {
        setLoginError(result.error || '登录失败');
      }
    } catch (e) {
       setLoginError('登录请求失败');
    }
  };

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync(formData);
    } catch (e) {
      console.error(e);
    }
    const updatedPrefs = { ...formData, sessionId: '' };
    setFormData(updatedPrefs);
    
    // Persist logout state
    await savePreferences(updatedPrefs);
    onSave(updatedPrefs);
  };

  const handleSave = async () => {
    await savePreferences(formData);
    if (formData.username) {
      await saveSettings(formData.username, formData);
    }
    onSave(formData);
    onClose();
  };

  const addVendorWeight = () => {
    if (newVendor) {
      setFormData(prev => ({
        ...prev,
        vendorWeights: { ...prev.vendorWeights, [newVendor]: newWeight }
      }));
      setNewVendor('');
      setNewWeight(0);
    }
  };

  const isLoggedIn = !!formData.sessionId;
  const isLoginLoading = loginMutation.isPending;

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
         className="bg-[#252525] rounded-3xl shadow-2xl p-4 md:p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-white/10"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">{t('settings.title')}</h2>
          <div className="flex items-center space-x-4">
             <div className="flex bg-[#181818] rounded-lg p-1 border border-white/10">
                <button 
                  onClick={() => i18n.changeLanguage('en')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${i18n.language.startsWith('en') ? 'bg-[#6FB92D] text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  EN
                </button>
                <button 
                  onClick={() => i18n.changeLanguage('zh')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${i18n.language.startsWith('zh') ? 'bg-[#6FB92D] text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  中
                </button>
             </div>
             <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">✕</button>
          </div>
        </div>

        <div className="space-y-6">
          {/* Connectivity */}
          <div className="p-6 bg-[#2A2A2A] rounded-2xl border border-white/5">
            <h3 className="font-semibold text-[#6FB92D] mb-4 flex items-center">
              <span className="w-2 h-2 rounded-full bg-[#6FB92D] mr-2"></span> {t('settings.connectivity')}
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <label className="flex items-center space-x-3 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={formData.useMockData}
                  onChange={(e) => handleChange('useMockData', e.target.checked)}
                  className="w-5 h-5 rounded border-gray-600 bg-[#333] text-[#6FB92D] focus:ring-[#6FB92D] focus:ring-offset-[#252525]"
                />
                <span className="text-sm text-gray-300 group-hover:text-white">{t('settings.useMockData')}</span>
              </label>
              
              {!formData.useMockData && (
                <>


                  {/* Login Status */}
                  {isLoggedIn ? (
                    <>
                      <div className="p-4 bg-[#6FB92D]/10 border border-[#6FB92D]/30 rounded-xl">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 rounded-full bg-[#6FB92D] animate-pulse"></div>
                            <span className="text-[#6FB92D] font-medium">{t('settings.loggedIn')}</span>
                            <span className="text-gray-400 text-sm">({formData.username})</span>
                          </div>
                          <button
                            onClick={handleLogout}
                            className="px-4 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors"
                          >
                            {t('settings.logout')}
                          </button>
                        </div>
                      </div>
                      
                      {/* Default Delivery Address */}
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">{t('settings.defaultAddress')}</label>
                        {addressLoading ? (
                          <div className="w-full rounded-xl border border-[#444] bg-[#181818] p-3 text-sm text-gray-500">
                            {t('settings.loadingAddresses')}
                          </div>
                        ) : addresses.length > 0 ? (
                          <select
                            value={formData.defaultAddressId || ''}
                            onChange={(e) => handleChange('defaultAddressId', e.target.value)}
                            className="w-full rounded-xl border border-[#444] bg-[#181818] shadow-sm p-3 text-sm text-gray-300 focus:border-[#6FB92D] focus:ring-1 focus:ring-[#6FB92D] outline-none transition-all"
                          >
                            <option value="">{t('settings.selectAddress')}</option>
                            {addresses.map((addr) => (
                              <option key={addr.uniqueId} value={addr.uniqueId}>
                                {addr.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="w-full rounded-xl border border-[#444] bg-[#181818] p-3 text-sm text-gray-500 flex items-center justify-between">
                            <span>{t('settings.addressNotFound')}</span>
                            <div className="text-[#6FB92D] text-xs">
                               {t('settings.autoFetched')}
                            </div>
                          </div>
                        )}
                        <p className="text-xs text-gray-500 mt-1">{t('settings.addressHint')}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Username */}
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">{t('settings.username')}</label>
                        <input 
                          type="text"
                          value={formData.username}
                          onChange={(e) => handleChange('username', e.target.value)}
                          className="w-full rounded-xl border border-[#444] bg-[#181818] shadow-sm p-3 text-sm text-gray-300 focus:border-[#6FB92D] focus:ring-1 focus:ring-[#6FB92D] outline-none transition-all"
                          placeholder={t('settings.usernamePlaceholder')}
                        />
                      </div>

                      {/* Password */}
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">{t('settings.password')}</label>
                        <input 
                          type="password"
                          value={formData.password}
                          onChange={(e) => handleChange('password', e.target.value)}
                          className="w-full rounded-xl border border-[#444] bg-[#181818] shadow-sm p-3 text-sm text-gray-300 focus:border-[#6FB92D] focus:ring-1 focus:ring-[#6FB92D] outline-none transition-all"
                          placeholder={t('settings.passwordPlaceholder')}
                        />
                      </div>

                      {/* Login Error */}
                      {loginError && (
                        <div className="text-red-400 text-sm bg-red-400/10 p-3 rounded-lg">
                          {loginError}
                        </div>
                      )}

                      {/* Login Button */}
                      <button
                        onClick={handleLogin}
                        disabled={isLoginLoading}
                        className={`w-full py-3 rounded-xl font-medium transition-all ${
                          isLoginLoading
                            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                            : 'bg-[#6FB92D] text-white hover:bg-[#5da025] shadow-lg shadow-[#6FB92D]/20'
                        }`}
                      >
                        {isLoginLoading ? t('settings.loggingIn') : t('settings.login')}
                      </button>
                    </>
                  )}
                </>
              )}
            </div>

          </div>

          {/* AI Configuration */}
          <div className="p-6 bg-[#2A2A2A] rounded-2xl border border-white/5">
            <h3 className="font-semibold text-[#6FB92D] mb-4 flex items-center">
              <span className="w-2 h-2 rounded-full bg-[#6FB92D] mr-2"></span> {t('settings.aiConfig')}
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">{t('settings.aiProvider')}</label>
                <select 
                  value={formData.aiProvider || 'gemini'}
                  onChange={(e) => handleChange('aiProvider', e.target.value)}
                  className="w-full rounded-xl border border-[#444] bg-[#181818] shadow-sm p-3 text-sm text-gray-300 focus:border-[#6FB92D] focus:ring-1 focus:ring-[#6FB92D] outline-none transition-all"
                >
                  <option value="gemini">{t('settings.geminiModel')}</option>
                  <option value="openrouter">OpenRouter (Free)</option>
                  <option value="custom">{t('settings.customAi')}</option>
                </select>
                {formData.aiProvider === 'openrouter' && (
                  <p className="text-xs text-yellow-500 mt-1">Free But Not Stable</p>
                )}
              </div>

              {formData.aiProvider === 'custom' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">{t('settings.baseUrl')}</label>
                    <input 
                      type="text"
                      value={formData.customAiBaseUrl || ''}
                      onChange={(e) => handleChange('customAiBaseUrl', e.target.value)}
                      className="w-full rounded-xl border border-[#444] bg-[#181818] shadow-sm p-3 text-sm text-gray-300 focus:border-[#6FB92D] focus:ring-1 focus:ring-[#6FB92D] outline-none transition-all"
                      placeholder="https://api.openai.com/v1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">{t('settings.apiKey')}</label>
                    <input 
                      type="password"
                      value={formData.customAiApiKey || ''}
                      onChange={(e) => handleChange('customAiApiKey', e.target.value)}
                      className="w-full rounded-xl border border-[#444] bg-[#181818] shadow-sm p-3 text-sm text-gray-300 focus:border-[#6FB92D] focus:ring-1 focus:ring-[#6FB92D] outline-none transition-all"
                      placeholder="sk-..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">{t('settings.modelName')}</label>
                    <input 
                      type="text"
                      value={formData.customAiModel || ''}
                      onChange={(e) => handleChange('customAiModel', e.target.value)}
                      className="w-full rounded-xl border border-[#444] bg-[#181818] shadow-sm p-3 text-sm text-gray-300 focus:border-[#6FB92D] focus:ring-1 focus:ring-[#6FB92D] outline-none transition-all"
                      placeholder="gpt-4o"
                    />
                  </div>
                </>
              ) : formData.aiProvider === 'openrouter' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">{t('settings.modelName')}</label>
                  <select 
                    value={formData.openRouterModel || 'nex-agi/deepseek-v3.1-nex-n1:free'}
                    onChange={(e) => handleChange('openRouterModel', e.target.value)}
                    className="w-full rounded-xl border border-[#444] bg-[#181818] shadow-sm p-3 text-sm text-gray-300 focus:border-[#6FB92D] focus:ring-1 focus:ring-[#6FB92D] outline-none transition-all"
                  >
                    <option value="nex-agi/deepseek-v3.1-nex-n1:free">DeepSeek V3.1 (Free)</option>
                    <option value="qwen/qwen3-235b-a22b:free">Qwen 2.5 (Free)</option>
                    <option value="moonshotai/kimi-k2:free">Kimi K2 (Free)</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">{t('settings.geminiApiKey')}</label>
                  <input 
                    type="password"
                    value={formData.geminiApiKey || ''}
                    onChange={(e) => handleChange('geminiApiKey', e.target.value)}
                    className="w-full rounded-xl border border-[#444] bg-[#181818] shadow-sm p-3 text-sm text-gray-300 focus:border-[#6FB92D] focus:ring-1 focus:ring-[#6FB92D] outline-none transition-all"
                    placeholder={t('settings.geminiApiKeyPlaceholder')}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Preferences */}
          <div className="p-6 bg-[#2A2A2A] rounded-2xl border border-white/5">
            <h3 className="font-semibold text-[#6FB92D] mb-4 flex items-center">
               <span className="w-2 h-2 rounded-full bg-[#6FB92D] mr-2"></span> {t('settings.dietaryPreferences')}
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div className="flex space-x-6">
                <label className="flex items-center space-x-3 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={formData.enableBreakfast || false}
                    onChange={(e) => handleChange('enableBreakfast', e.target.checked)}
                    className="w-5 h-5 rounded border-gray-600 bg-[#333] text-[#6FB92D] focus:ring-[#6FB92D] focus:ring-offset-[#252525]"
                  />
                  <span className="text-sm text-gray-300 group-hover:text-white">{t('settings.includeBreakfast')}</span>
                </label>
                <label className="flex items-center space-x-3 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={formData.enableWeekends || false}
                    onChange={(e) => handleChange('enableWeekends', e.target.checked)}
                    className="w-5 h-5 rounded border-gray-600 bg-[#333] text-[#6FB92D] focus:ring-[#6FB92D] focus:ring-offset-[#252525]"
                  />
                  <span className="text-sm text-gray-300 group-hover:text-white">{t('settings.includeWeekends')}</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">{t('settings.planningMode')}</label>
                <select 
                  value={formData.planningMode}
                  onChange={(e) => handleChange('planningMode', e.target.value)}
                  className="w-full rounded-xl border border-[#444] bg-[#181818] shadow-sm p-3 text-sm text-gray-300 focus:border-[#6FB92D] focus:ring-1 focus:ring-[#6FB92D] outline-none transition-all"
                >
                  <option value="balanced">{t('settings.modeBalanced')}</option>
                  <option value="health">{t('settings.modeHealth')}</option>
                  <option value="preference">{t('settings.modeTaste')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">{t('settings.excludedKeywords')}</label>
                <input 
                  type="text"
                  value={formData.excludedKeywords.join(', ')}
                  onChange={(e) => handleChange('excludedKeywords', e.target.value.split(',').map(s => s.trim()))}
                  className="w-full rounded-xl border border-[#444] bg-[#181818] shadow-sm p-3 text-sm text-gray-300 focus:border-[#6FB92D] focus:ring-1 focus:ring-[#6FB92D] outline-none transition-all"
                  placeholder="peanuts, cilantro, spicy"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">{t('settings.vendorWeights')}</label>
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 mt-1 mb-3">
                  <input 
                    placeholder={t('settings.restaurantName')}
                    value={newVendor}
                    onChange={(e) => setNewVendor(e.target.value)}
                    className="flex-1 rounded-xl border border-[#444] bg-[#181818] p-3 text-sm text-gray-300 focus:border-[#6FB92D] outline-none"
                  />
                  <input 
                    type="number"
                    placeholder={t('settings.score')}
                    value={newWeight}
                    onChange={(e) => setNewWeight(parseInt(e.target.value))}
                    className="w-20 rounded-xl border border-[#444] bg-[#181818] p-3 text-sm text-gray-300 focus:border-[#6FB92D] outline-none"
                  />
                  <button onClick={addVendorWeight} className="bg-[#333] border border-[#444] hover:border-[#6FB92D] hover:text-[#6FB92D] text-gray-300 px-4 py-1 rounded-xl text-sm transition-colors">{t('settings.add')}</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(formData.vendorWeights).map(([vendor, weight]) => (
                    <span key={vendor} className="bg-[#181818] border border-[#333] px-3 py-1.5 rounded-lg text-xs flex items-center text-gray-300">
                      {vendor} <span className={(weight as number) > 0 ? "text-[#6FB92D] ml-1.5 font-bold" : "text-red-500 ml-1.5 font-bold"}>{weight as number}</span>
                      <button 
                        onClick={() => {
                          const newW = {...formData.vendorWeights};
                          delete newW[vendor];
                          handleChange('vendorWeights', newW);
                        }}
                        className="ml-2 text-gray-500 hover:text-red-400 text-lg leading-none"
                      >×</button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col-reverse sm:flex-row justify-end gap-4 sm:space-x-4">
          <button onClick={onClose} className="w-full sm:w-auto px-6 py-2.5 rounded-full text-gray-400 hover:bg-[#333] transition-colors font-medium">{t('settings.cancel')}</button>
          <button onClick={handleSave} className="w-full sm:w-auto px-8 py-2.5 bg-[#6FB92D] text-white rounded-full hover:bg-[#5da025] shadow-lg shadow-[#6FB92D]/20 transition-all font-medium">{t('settings.save')}</button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default SettingsPanel;