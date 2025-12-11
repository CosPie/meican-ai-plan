import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnalysisResult, HistoricalOrder, UserPreferences } from '../types';
import { getOrderHistory } from '../services/db';
import { GeminiService } from '../services/geminiService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface Props {
  prefs: UserPreferences;
  onClose: () => void;
}

const COLORS = ['#6FB92D', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'];

import { motion } from 'framer-motion';

const AnalysisPanel: React.FC<Props> = ({ prefs, onClose }) => {
  const { t, i18n } = useTranslation();
  const [history, setHistory] = useState<HistoricalOrder[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    setHistoryLoading(true);
    getOrderHistory(prefs)
      .then(setHistory)
      .finally(() => setHistoryLoading(false));
  }, [prefs]);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const ai = new GeminiService();
      const res = await ai.analyzeHistory(history, prefs, i18n.language);
      setResult(res);
    } catch (e) {
      console.error("Analysis Failed:", e);
      alert(t('analysis.analysisFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="fixed inset-0 bg-[#181818] z-40 overflow-y-auto custom-scrollbar"
    >
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex justify-between items-center mb-10">
          <div>
            <div className="flex items-end gap-4">
              <h1 className="text-4xl font-bold text-white tracking-tight">{t('analysis.titlePrefix')} <span className="text-[#6FB92D]">{t('analysis.titleSuffix')}</span></h1>
              {result?.modelName && (
                <span className="px-2 py-1 rounded-md bg-[#333] border border-[#444] text-xs text-gray-400 mb-1 font-mono">
                  {result.modelName}
                </span>
              )}
            </div>
            <p className="text-gray-400 mt-2 text-lg">{t('analysis.subtitle', { count: history.length })}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white hover:bg-[#252525] px-6 py-3 rounded-full border border-transparent hover:border-[#333] transition-all">{t('analysis.backToDashboard')}</button>
        </div>

        {historyLoading && (
          <div className="flex justify-center items-center py-40">
            <div className="relative">
               <div className="animate-spin rounded-full h-20 w-20 border-t-2 border-b-2 border-[#6FB92D]"></div>
               <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-500 font-mono">📋</div>
            </div>
            <p className="ml-6 text-gray-400 text-lg">{t('analysis.loadingHistory')}</p>
          </div>
        )}

        {!historyLoading && !result && !loading && (
           <div className="flex flex-col items-center justify-center py-32 bg-[#252525] rounded-3xl border border-white/5 shadow-2xl">
             <div className="text-7xl mb-6 opacity-50">🍱</div>
              <p className="text-gray-300 mb-8 text-xl font-light">{t('analysis.readyToAnalyze')}</p>
              <button 
                onClick={runAnalysis}
                className="bg-[#6FB92D] text-white px-10 py-4 rounded-full shadow-[0_0_30px_rgba(111,185,45,0.3)] hover:bg-[#5da025] hover:scale-105 transition-all font-bold text-lg"
                disabled={history.length === 0}
              >
                {history.length === 0 ? t('analysis.noHistory') : t('analysis.generateReport')}
             </button>
           </div>
        )}

        {loading && (
          <div className="flex justify-center items-center py-40">
            <div className="relative">
               <div className="animate-spin rounded-full h-20 w-20 border-t-2 border-b-2 border-[#6FB92D]"></div>
               <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-500 font-mono">AI</div>
            </div>
          </div>
        )}

        {result && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
            {/* Health Score Card */}
            <div className="bg-[#252525] p-8 rounded-3xl shadow-lg border border-white/5 col-span-1 md:col-span-2 flex items-center relative overflow-hidden group">
               <div className="absolute right-0 top-0 w-64 h-64 bg-[#6FB92D] opacity-5 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2 group-hover:opacity-10 transition-opacity"></div>
               
               <div className="w-32 h-32 rounded-full bg-[#1e1e1e] flex items-center justify-center shadow-inner border-4 border-[#333] relative z-10">
                 <span className="text-5xl font-bold text-[#6FB92D]">{result.score}</span>
               </div>
               <div className="ml-8 flex-1 relative z-10">
                 <h3 className="text-2xl font-bold text-white mb-2">{t('analysis.healthScore')}</h3>
                 <p className="text-gray-400 text-lg leading-relaxed">{result.summary}</p>
               </div>
            </div>

            {/* Suggestions */}
            <div className="bg-[#252525] p-8 rounded-3xl shadow-lg border border-white/5">
              <h3 className="text-xl font-bold mb-6 text-white flex items-center">
                <span className="w-2 h-6 bg-[#6FB92D] rounded-full mr-3"></span> {t('analysis.aiSuggestions')}
              </h3>
              <ul className="space-y-4">
                {result.suggestions.map((s, i) => (
                  <li key={i} className="flex items-start bg-[#1e1e1e] p-4 rounded-xl border border-[#333]">
                    <span className="text-[#6FB92D] mr-3 mt-0.5 text-lg">✓</span>
                    <span className="text-gray-300">{s}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Charts */}
            <div className="bg-[#252525] p-8 rounded-3xl shadow-lg border border-white/5">
               <h3 className="text-xl font-bold mb-6 text-white flex items-center">
                 <span className="w-2 h-6 bg-blue-500 rounded-full mr-3"></span> {t('analysis.cuisineDistribution')}
               </h3>
               <div className="h-64">
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={result.cuisineDistribution} 
                        dataKey="value" 
                        nameKey="name" 
                        cx="50%" 
                        cy="50%" 
                        innerRadius={60}
                        outerRadius={80} 
                        stroke="none"
                        paddingAngle={5}
                      >
                        {result.cuisineDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#333', borderColor: '#444', borderRadius: '12px', color: '#fff' }}
                        itemStyle={{ color: '#ccc' }}
                      />
                    </PieChart>
                 </ResponsiveContainer>
               </div>
               <div className="flex justify-center flex-wrap gap-4 mt-4">
                  {result.cuisineDistribution.map((entry, index) => (
                    <div key={index} className="flex items-center text-xs text-gray-400">
                      <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                      {entry.name}
                    </div>
                  ))}
               </div>
            </div>

            <div className="bg-[#252525] p-8 rounded-3xl shadow-lg border border-white/5 col-span-1 md:col-span-2">
              <h3 className="text-xl font-bold mb-6 text-white flex items-center">
                <span className="w-2 h-6 bg-orange-500 rounded-full mr-3"></span> {t('analysis.calorieTrend')}
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={result.calorieTrend} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#444" vertical={false} />
                    <XAxis dataKey="date" stroke="#666" tick={{ fill: '#888' }} />
                    <YAxis stroke="#666" tick={{ fill: '#888' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#333', borderColor: '#444', borderRadius: '12px', color: '#fff' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="calories" 
                      stroke="#F59E0B" 
                      strokeWidth={3} 
                      dot={{ r: 4, fill: '#252525', stroke: '#F59E0B', strokeWidth: 2 }}
                      activeDot={{ r: 8 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default AnalysisPanel;