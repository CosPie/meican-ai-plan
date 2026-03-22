import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { UserPreferences } from '../types';
import { DIETARY_RESTRICTIONS, COMMON_ALLERGENS, POPULAR_CUISINES } from '../constants/dietaryPresets';
import { getOrderHistory } from '../services/db';

interface Props {
  preferences: UserPreferences;
  onChange: (field: keyof UserPreferences, value: any) => void;
}

interface VendorSuggestion {
  name: string;
  orderCount: number;
  lastOrderDate: string;
}

const DietaryPreferencesSection: React.FC<Props> = ({ preferences, onChange }) => {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language.startsWith('zh') ? 'zh' : 'en';

  // Local state for new inputs
  const [newExcluded, setNewExcluded] = useState('');
  const [newFavorite, setNewFavorite] = useState('');
  const [newCuisine, setNewCuisine] = useState('');
  const [newVendor, setNewVendor] = useState('');
  const [newWeight, setNewWeight] = useState(0);

  // Vendor suggestions from history
  const [vendorSuggestions, setVendorSuggestions] = useState<VendorSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Load vendor suggestions from order history
  useEffect(() => {
    const loadVendorSuggestions = async () => {
      try {
        const history = await getOrderHistory(preferences);
        if (history.length === 0) return;

        // Count orders by restaurant
        const vendorCounts = new Map<string, { count: number; lastDate: string }>();

        history.forEach(order => {
          const existing = vendorCounts.get(order.restaurantName);
          if (existing) {
            existing.count++;
            if (order.date > existing.lastDate) {
              existing.lastDate = order.date;
            }
          } else {
            vendorCounts.set(order.restaurantName, { count: 1, lastDate: order.date });
          }
        });

        // Convert to array and sort by order count
        const suggestions = Array.from(vendorCounts.entries())
          .map(([name, data]) => ({
            name,
            orderCount: data.count,
            lastOrderDate: data.lastDate
          }))
          .sort((a, b) => b.orderCount - a.orderCount)
          .slice(0, 10); // Top 10 restaurants

        setVendorSuggestions(suggestions);
      } catch (error) {
        console.error('Failed to load vendor suggestions:', error);
      }
    };

    loadVendorSuggestions();
  }, [preferences]);

  // Initialize arrays if undefined
  const dietaryRestrictions = preferences.dietaryRestrictions || [];
  const favoriteIngredients = preferences.favoriteIngredients || [];
  const allergens = preferences.allergens || [];
  const cuisinePreferences = preferences.cuisinePreferences || [];

  // Toggle dietary restriction
  const toggleRestriction = (id: string) => {
    const restriction = DIETARY_RESTRICTIONS.find(r => r.id === id);
    if (!restriction) return;

    const isSelected = dietaryRestrictions.includes(id);
    const newRestrictions = isSelected
      ? dietaryRestrictions.filter(r => r !== id)
      : [...dietaryRestrictions, id];

    onChange('dietaryRestrictions', newRestrictions);

    // Auto-update excluded keywords based on restriction
    if (!isSelected) {
      const currentExcluded = preferences.excludedKeywords || [];
      const newExcluded = [...new Set([...currentExcluded, ...restriction.keywords])];
      onChange('excludedKeywords', newExcluded);
    }
  };

  // Toggle allergen
  const toggleAllergen = (id: string) => {
    const allergen = COMMON_ALLERGENS.find(a => a.id === id);
    if (!allergen) return;

    const isSelected = allergens.includes(id);
    const newAllergens = isSelected
      ? allergens.filter(a => a !== id)
      : [...allergens, id];

    onChange('allergens', newAllergens);

    // Auto-update excluded keywords for allergens
    if (!isSelected) {
      const currentExcluded = preferences.excludedKeywords || [];
      const newExcluded = [...new Set([...currentExcluded, ...allergen.keywords])];
      onChange('excludedKeywords', newExcluded);
    }
  };

  // Add excluded ingredient
  const addExcludedIngredient = () => {
    if (newExcluded.trim()) {
      const current = preferences.excludedKeywords || [];
      onChange('excludedKeywords', [...current, newExcluded.trim()]);
      setNewExcluded('');
    }
  };

  // Remove excluded ingredient
  const removeExcludedIngredient = (keyword: string) => {
    const current = preferences.excludedKeywords || [];
    onChange('excludedKeywords', current.filter(k => k !== keyword));
  };

  // Add favorite ingredient
  const addFavoriteIngredient = () => {
    if (newFavorite.trim()) {
      onChange('favoriteIngredients', [...favoriteIngredients, newFavorite.trim()]);
      setNewFavorite('');
    }
  };

  // Remove favorite ingredient
  const removeFavoriteIngredient = (ingredient: string) => {
    onChange('favoriteIngredients', favoriteIngredients.filter(i => i !== ingredient));
  };

  // Update cuisine preference
  const updateCuisinePreference = (cuisineId: string, rating: number) => {
    onChange('cuisinePreferences', { ...cuisinePreferences, [cuisineId]: rating });
  };

  // Remove cuisine preference
  const removeCuisinePreference = (cuisineId: string) => {
    const updated = { ...cuisinePreferences };
    delete updated[cuisineId];
    onChange('cuisinePreferences', updated);
  };

  // Add custom cuisine
  const addCustomCuisine = () => {
    if (newCuisine.trim()) {
      onChange('cuisinePreferences', { ...cuisinePreferences, [newCuisine.trim()]: 5 });
      setNewCuisine('');
    }
  };

  // Add vendor weight (existing functionality)
  const addVendorWeight = () => {
    if (newVendor.trim()) {
      onChange('vendorWeights', { ...preferences.vendorWeights, [newVendor.trim()]: newWeight });
      setNewVendor('');
      setNewWeight(0);
    }
  };

  // Add vendor from suggestion
  const addVendorFromSuggestion = (vendorName: string, suggestedWeight: number) => {
    onChange('vendorWeights', { ...preferences.vendorWeights, [vendorName]: suggestedWeight });
  };

  return (
    <div className="p-4 sm:p-6 bg-[#2A2A2A] rounded-2xl border border-white/5">
      <h3 className="font-semibold text-[#6FB92D] mb-3 sm:mb-4 flex items-center text-base sm:text-lg">
        <span className="w-2.5 h-2.5 sm:w-2 sm:h-2 rounded-full bg-[#6FB92D] mr-2"></span>
        {t('settings.dietaryPreferences')}
      </h3>

      <div className="space-y-6">
        {/* Quick Presets */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">{t('settings.quickPresets')}</label>
          <div className="flex flex-wrap gap-2">
            {DIETARY_RESTRICTIONS.map((restriction) => (
              <button
                key={restriction.id}
                onClick={() => toggleRestriction(restriction.id)}
                className={`min-h-touch px-4 py-2 rounded-lg text-sm font-medium transition-all tap-highlight-none ${
                  dietaryRestrictions.includes(restriction.id)
                    ? 'bg-[#6FB92D] text-white shadow-md'
                    : 'bg-[#181818] text-gray-300 border border-[#444] hover:border-[#6FB92D]'
                }`}
              >
                {restriction.label[currentLang]}
              </button>
            ))}
          </div>
        </div>

        {/* Allergens */}
        <div className="bg-red-500/5 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-red-400 text-xl">⚠️</span>
            <label className="text-sm font-semibold text-red-400">{t('settings.allergens')}</label>
          </div>
          <p className="text-xs text-gray-400 mb-3">{t('settings.allergensWarning')}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {COMMON_ALLERGENS.map((allergen) => (
              <label
                key={allergen.id}
                className="flex items-center space-x-2 min-h-touch cursor-pointer group bg-[#181818] hover:bg-[#252525] rounded-lg p-2 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={allergens.includes(allergen.id)}
                  onChange={() => toggleAllergen(allergen.id)}
                  className="w-5 h-5 rounded border-gray-600 bg-[#333] text-red-500 focus:ring-red-500 focus:ring-offset-[#252525]"
                />
                <span className="text-sm text-gray-300 group-hover:text-white">{allergen.label[currentLang]}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Exclude Ingredients */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">{t('settings.excludeIngredients')}</label>
          <div className="flex flex-col sm:flex-row gap-2 mb-2">
            <input
              type="text"
              value={newExcluded}
              onChange={(e) => setNewExcluded(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addExcludedIngredient()}
              placeholder={t('settings.excludedKeywords')}
              className="flex-1 min-h-touch rounded-xl border border-[#444] bg-[#181818] p-3 text-base text-gray-300 focus:border-[#6FB92D] focus:ring-1 focus:ring-[#6FB92D] outline-none"
            />
            <button
              onClick={addExcludedIngredient}
              className="min-h-touch px-6 bg-[#333] border border-[#444] hover:border-[#6FB92D] hover:text-[#6FB92D] text-gray-300 rounded-xl text-sm transition-colors tap-highlight-none"
            >
              {t('settings.add')}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(preferences.excludedKeywords || []).map((keyword) => (
              <span
                key={keyword}
                className="bg-[#181818] border border-red-500/30 px-3 py-1.5 rounded-lg text-xs flex items-center text-gray-300"
              >
                {keyword}
                <button
                  onClick={() => removeExcludedIngredient(keyword)}
                  className="ml-2 text-gray-500 hover:text-red-400 text-lg leading-none tap-highlight-none"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Favorite Ingredients */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">{t('settings.favoriteIngredients')}</label>
          <div className="flex flex-col sm:flex-row gap-2 mb-2">
            <input
              type="text"
              value={newFavorite}
              onChange={(e) => setNewFavorite(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addFavoriteIngredient()}
              placeholder={t('settings.addIngredient')}
              className="flex-1 min-h-touch rounded-xl border border-[#444] bg-[#181818] p-3 text-base text-gray-300 focus:border-[#6FB92D] focus:ring-1 focus:ring-[#6FB92D] outline-none"
            />
            <button
              onClick={addFavoriteIngredient}
              className="min-h-touch px-6 bg-[#333] border border-[#444] hover:border-[#6FB92D] hover:text-[#6FB92D] text-gray-300 rounded-xl text-sm transition-colors tap-highlight-none"
            >
              {t('settings.add')}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {favoriteIngredients.map((ingredient) => (
              <span
                key={ingredient}
                className="bg-[#181818] border border-[#6FB92D]/30 px-3 py-1.5 rounded-lg text-xs flex items-center text-gray-300"
              >
                {ingredient}
                <button
                  onClick={() => removeFavoriteIngredient(ingredient)}
                  className="ml-2 text-gray-500 hover:text-red-400 text-lg leading-none tap-highlight-none"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Cuisine Preferences */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">{t('settings.cuisinePreferences')}</label>

          {/* Popular Cuisines */}
          <div className="space-y-3 mb-3">
            {POPULAR_CUISINES.filter(c => !(c.id in cuisinePreferences)).slice(0, 3).map((cuisine) => (
              <button
                key={cuisine.id}
                onClick={() => updateCuisinePreference(cuisine.id, 5)}
                className="w-full min-h-touch text-left px-4 py-2 bg-[#181818] border border-[#444] hover:border-[#6FB92D] rounded-lg text-sm text-gray-300 hover:text-white transition-colors tap-highlight-none"
              >
                + {cuisine.label[currentLang]}
              </button>
            ))}
          </div>

          {/* Active Cuisine Preferences with Sliders */}
          <div className="space-y-3">
            {Object.entries(cuisinePreferences).map(([cuisineId, rating]) => {
              const cuisine = POPULAR_CUISINES.find(c => c.id === cuisineId);
              const label = cuisine ? cuisine.label[currentLang] : cuisineId;

              return (
                <div key={cuisineId} className="bg-[#181818] rounded-lg p-3 border border-[#333]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-300">{label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[#6FB92D] font-bold text-sm">{rating}/10</span>
                      <button
                        onClick={() => removeCuisinePreference(cuisineId)}
                        className="text-gray-500 hover:text-red-400 text-lg leading-none tap-highlight-none"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={rating}
                    onChange={(e) => updateCuisinePreference(cuisineId, parseInt(e.target.value))}
                    className="w-full h-2 bg-[#333] rounded-lg appearance-none cursor-pointer slider-thumb-green"
                  />
                </div>
              );
            })}
          </div>

          {/* Custom Cuisine Input */}
          <div className="flex flex-col sm:flex-row gap-2 mt-3">
            <input
              type="text"
              value={newCuisine}
              onChange={(e) => setNewCuisine(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addCustomCuisine()}
              placeholder={t('settings.addCuisine')}
              className="flex-1 min-h-touch rounded-xl border border-[#444] bg-[#181818] p-3 text-base text-gray-300 focus:border-[#6FB92D] focus:ring-1 focus:ring-[#6FB92D] outline-none"
            />
            <button
              onClick={addCustomCuisine}
              className="min-h-touch px-6 bg-[#333] border border-[#444] hover:border-[#6FB92D] hover:text-[#6FB92D] text-gray-300 rounded-xl text-sm transition-colors tap-highlight-none"
            >
              {t('settings.add')}
            </button>
          </div>
        </div>

        {/* Vendor Weights (Improved with Suggestions) */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">{t('settings.vendorWeights')}</label>
          <p className="text-xs text-gray-500 mb-3">{t('settings.vendorWeightsHint')}</p>

          {/* Suggestions from History */}
          {vendorSuggestions.length > 0 && (
            <div className="mb-4">
              <button
                onClick={() => setShowSuggestions(!showSuggestions)}
                className="flex items-center gap-2 text-sm text-[#6FB92D] hover:text-[#5da025] mb-2 tap-highlight-none"
              >
                <span>{showSuggestions ? '▼' : '▶'}</span>
                {t('settings.suggestionsFromHistory')} ({vendorSuggestions.length})
              </button>

              {showSuggestions && (
                <div className="bg-[#181818] border border-[#333] rounded-xl p-3 space-y-2 mb-3">
                  <p className="text-xs text-gray-400 mb-2">{t('settings.clickToAddVendor')}</p>
                  {vendorSuggestions
                    .filter(v => !(v.name in (preferences.vendorWeights || {})))
                    .slice(0, 6)
                    .map((vendor) => (
                      <div
                        key={vendor.name}
                        className="flex items-center justify-between bg-[#252525] rounded-lg p-2 hover:bg-[#2A2A2A] transition-colors"
                      >
                        <div className="flex-1">
                          <div className="text-sm text-gray-300">{vendor.name}</div>
                          <div className="text-xs text-gray-500">
                            {t('settings.orderedTimes', { count: vendor.orderCount })}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => addVendorFromSuggestion(vendor.name, 5)}
                            className="min-h-touch px-3 py-1 bg-[#6FB92D] text-white text-xs rounded-lg hover:bg-[#5da025] transition-colors tap-highlight-none"
                          >
                            👍 +5
                          </button>
                          <button
                            onClick={() => addVendorFromSuggestion(vendor.name, -5)}
                            className="min-h-touch px-3 py-1 bg-red-500/20 text-red-400 text-xs rounded-lg hover:bg-red-500/30 transition-colors tap-highlight-none"
                          >
                            👎 -5
                          </button>
                        </div>
                      </div>
                    ))}
                  {vendorSuggestions.filter(v => !(v.name in (preferences.vendorWeights || {}))).length === 0 && (
                    <p className="text-xs text-gray-500 text-center py-2">{t('settings.allSuggestionsAdded')}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Manual Input */}
          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <input
              type="text"
              value={newVendor}
              onChange={(e) => setNewVendor(e.target.value)}
              placeholder={t('settings.restaurantName')}
              className="flex-1 min-h-touch rounded-xl border border-[#444] bg-[#181818] p-3 text-base text-gray-300 focus:border-[#6FB92D] focus:ring-1 focus:ring-[#6FB92D] outline-none"
            />
            <input
              type="number"
              value={newWeight}
              onChange={(e) => setNewWeight(parseInt(e.target.value) || 0)}
              placeholder={t('settings.score')}
              className="w-full sm:w-24 min-h-touch rounded-xl border border-[#444] bg-[#181818] p-3 text-base text-gray-300 focus:border-[#6FB92D] focus:ring-1 focus:ring-[#6FB92D] outline-none"
            />
            <button
              onClick={addVendorWeight}
              className="min-h-touch px-6 bg-[#333] border border-[#444] hover:border-[#6FB92D] hover:text-[#6FB92D] text-gray-300 rounded-xl text-sm transition-colors tap-highlight-none"
            >
              {t('settings.add')}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(preferences.vendorWeights || {}).map(([vendor, weight]) => (
              <span
                key={vendor}
                className="bg-[#181818] border border-[#333] px-3 py-1.5 rounded-lg text-xs flex items-center text-gray-300"
              >
                {vendor}
                <span className={(weight as number) > 0 ? 'text-[#6FB92D] ml-1.5 font-bold' : 'text-red-500 ml-1.5 font-bold'}>
                  {weight as number}
                </span>
                <button
                  onClick={() => {
                    const updated = { ...preferences.vendorWeights };
                    delete updated[vendor];
                    onChange('vendorWeights', updated);
                  }}
                  className="ml-2 text-gray-500 hover:text-red-400 text-lg leading-none tap-highlight-none"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Planning Mode */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">{t('settings.planningMode')}</label>
          <select
            value={preferences.planningMode}
            onChange={(e) => onChange('planningMode', e.target.value)}
            className="w-full min-h-touch rounded-xl border border-[#444] bg-[#181818] shadow-sm p-3 text-base text-gray-300 focus:border-[#6FB92D] focus:ring-1 focus:ring-[#6FB92D] outline-none transition-all"
          >
            <option value="balanced">{t('settings.modeBalanced')}</option>
            <option value="health">{t('settings.modeHealth')}</option>
            <option value="preference">{t('settings.modeTaste')}</option>
          </select>
        </div>
      </div>

      <style>{`
        .slider-thumb-green::-webkit-slider-thumb {
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #6FB92D;
          cursor: pointer;
          box-shadow: 0 0 8px rgba(111, 185, 45, 0.5);
        }
        .slider-thumb-green::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #6FB92D;
          cursor: pointer;
          border: none;
          box-shadow: 0 0 8px rgba(111, 185, 45, 0.5);
        }
      `}</style>
    </div>
  );
};

export default DietaryPreferencesSection;
