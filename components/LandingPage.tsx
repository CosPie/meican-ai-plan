import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPreferences } from '../types';
import { useLogin } from '../hooks/useMeican';
import { savePreferences } from '../services/db';

interface Props {
  initialPrefs: UserPreferences;
  onLoginSuccess: (prefs: UserPreferences) => void;
}

const LandingPage: React.FC<Props> = ({ initialPrefs, onLoginSuccess }) => {
  const { t } = useTranslation();
  const [username, setUsername] = useState(initialPrefs.username || '');
  const [password, setPassword] = useState(initialPrefs.password || '');
  
  const [proxyUrl, setProxyUrl] = useState(() => {
    if (initialPrefs.proxyUrl) return initialPrefs.proxyUrl;
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
      return `http://${window.location.hostname}:8080`;
    }
    return '';
  });
  
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
        proxyUrl // Use the state variable
      });

      if (result.success && result.sessionId) {
        const updatedPrefs = { 
          ...initialPrefs, 
          username, 
          password, 
          sessionId: result.sessionId,
          proxyUrl,
          aiProvider
        };
        await savePreferences(updatedPrefs);
        onLoginSuccess(updatedPrefs);
      } else {
        setError(result.error || t('login.loginFailed'));
      }
    } catch (e) {
      setError(t('login.networkError'));
    }
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

             {typeof window !== 'undefined' && window.location.hostname !== 'localhost' && (
               <>
                 <div className="relative group">
                    <input
                      type="text"
                      value={proxyUrl}
                      onChange={(e) => setProxyUrl(e.target.value)}
                      placeholder={t('login.proxyPlaceholder')}
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
               </>
             )}
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
