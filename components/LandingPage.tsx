import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPreferences } from '../types';
import { useLogin } from '../hooks/useMeican';
import { savePreferences } from '../services/db';
import { getSettings } from '../services/meicanService';

interface Props {
  initialPrefs: UserPreferences;
  onLoginSuccess: (prefs: UserPreferences) => void;
}

const LandingPage: React.FC<Props> = ({ initialPrefs, onLoginSuccess }) => {
  const { t, i18n } = useTranslation();
  const [username, setUsername] = useState(initialPrefs.username || '');
  const [password, setPassword] = useState(initialPrefs.password || '');
  

  
  const [aiProvider, setAiProvider] = useState<'gemini' | 'custom'>(initialPrefs.aiProvider || 'gemini');

  const [error, setError] = useState('');
  const loginMutation = useLogin();

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!username || !password) {
      setError(t('login.enterCreds'));
      return;
    }

    setError('');
    
    try {
      const result = await loginMutation.mutateAsync({
        username,
        password,

      });

      if (result.success && result.sessionId) {
        let updatedPrefs = { 
          ...initialPrefs, 
          username, 
          password, 
          sessionId: result.sessionId,

          aiProvider
        };

        // Fetch settings from backend
        try {
          const backendSettings = await getSettings(username, result.sessionId);
          if (backendSettings) {
             updatedPrefs = { ...updatedPrefs, ...backendSettings };
          }
        } catch (e) {
          console.error('Failed to fetch settings on login:', e);
        }

        await savePreferences(updatedPrefs);
        onLoginSuccess(updatedPrefs);
      } else {
        setError(result.error || t('login.loginFailed'));
      }
    } catch (e) {
      setError(t('login.networkError'));
    }
  };

  const toggleLanguage = () => {
    const newLang = i18n.language.startsWith('zh') ? 'en' : 'zh';
    i18n.changeLanguage(newLang);
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden bg-[#181818] text-white">
      {/* Background Elements */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.1 }}
        transition={{ duration: 1 }}
        className="absolute inset-0 z-0 pointer-events-none"
      >
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-[#6FB92D] rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] bg-blue-500 rounded-full blur-[100px]" />
      </motion.div>

      {/* Language Toggle */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        onClick={toggleLanguage}
        className="absolute top-6 right-6 z-20 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 backdrop-blur-sm text-white transition-all flex items-center gap-2 group"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <svg className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5h12M9 3v2m1.204 12.596a12.097 12.097 0 01-5.78 5.78m5.78-5.78l-2.5-2.5m2.5 2.5l2.5 2.5m-5.78-5.78l2.5-2.5m-2.5 2.5A12.097 12.097 0 013 15m18 0V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2z" />
        </svg>
        <span className="text-sm font-medium text-gray-300 group-hover:text-white">
          {i18n.language.startsWith('zh') ? 'English' : '中文'}
        </span>
      </motion.button>

      {/* Main Content */}
      <div className="z-10 flex flex-col items-center w-full max-w-md px-6">
        
        {/* Slogan Area */}
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex flex-col items-center justify-center flex-1 mb-20 text-center"
        >
             <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.2 }}
              className="w-20 h-20 mb-8 bg-gradient-to-br from-[#6FB92D] to-[#5da025] rounded-3xl shadow-2xl shadow-[#6FB92D]/20 flex items-center justify-center"
            >
              <span className="text-4xl font-bold text-white">M</span>
            </motion.div>
            
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
              {t('login.titlePrefix')} <span className="text-[#6FB92D]">{t('login.titleSuffix')}</span> {t('login.titlePlanner')}
            </h1>
            
            <p className="text-lg text-gray-400 max-w-sm leading-relaxed">
              {t('login.subtitle1')} <br/>
              {t('login.subtitle2')}
            </p>
        </motion.div>

        {/* Login Form at Bottom */}
        <motion.form 
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          onSubmit={handleLogin}
          className="w-full space-y-4"
        >
          <div className="space-y-3">
             <div className="relative group">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t('login.usernamePlaceholder')}
                  className="w-full bg-[#252525] border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-gray-500 focus:outline-none focus:border-[#6FB92D] focus:ring-1 focus:ring-[#6FB92D] transition-all"
                />
             </div>
             
             <div className="relative group">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('login.passwordPlaceholder')}
                  className="w-full bg-[#252525] border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-gray-500 focus:outline-none focus:border-[#6FB92D] focus:ring-1 focus:ring-[#6FB92D] transition-all"
                />
             </div>

                 <div className="relative group">
                    <div className="relative">
                      <select
                        value={aiProvider}
                        onChange={(e) => setAiProvider(e.target.value as 'gemini' | 'custom')}
                        className="w-full bg-[#252525] border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-gray-500 focus:outline-none focus:border-[#6FB92D] focus:ring-1 focus:ring-[#6FB92D] transition-all appearance-none cursor-pointer"
                      >
                        <option value="gemini">{t('settings.geminiDefault').replace(' (Default)', '')} ({t('settings.default')})</option>
                        <option value="custom">{t('settings.customAi')}</option>
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none">
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                      </div>
                    </div>
                 </div>
          </div>

          <div className="flex items-center justify-between pt-4">
             <AnimatePresence>
                {error && (
                  <motion.p 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-red-400 text-sm"
                  >
                    {error}
                  </motion.p>
                )}
             </AnimatePresence>

             <motion.button
                type="submit"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                disabled={loginMutation.isPending}
                className={`ml-auto flex items-center justify-center w-14 h-14 rounded-full bg-[#6FB92D] text-white shadow-lg shadow-[#6FB92D]/30 transition-all ${
                  loginMutation.isPending ? 'opacity-70 cursor-wait' : 'hover:bg-[#5da025]'
                }`}
             >
                {loginMutation.isPending ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg 
                    width="24" 
                    height="24" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14" />
                    <path d="M12 5l7 7-7 7" />
                  </svg>
                )}
             </motion.button>
          </div>
        </motion.form>
        
        {/* Footer info or padding */}
        <div className="h-10"></div>
      </div>
    </div>
  );
};

export default LandingPage;
