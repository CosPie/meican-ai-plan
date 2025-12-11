import { GoogleGenAI } from '@google/genai';
import { Dish, HistoricalOrder, UserPreferences, AnalysisResult, PlannedOrder, MealTime } from '../types';

export class GeminiService {
  private genAI: GoogleGenAI;

  constructor() {
    this.genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  // Common method to send request to Custom AI via Backend Proxy
  private async callCustomAI(prompt: string, prefs: UserPreferences): Promise<string> {
    const response = await fetch(`${prefs.proxyUrl || ''}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        baseUrl: prefs.customAiBaseUrl,
        apiKey: prefs.customAiApiKey,
        model: prefs.customAiModel,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Custom AI Error: ${err}`);
    }

    const data = await response.json();
    // Assuming OpenAI format
    return data.choices?.[0]?.message?.content || '';
  }

  async generateWeeklyPlan(
    availableSlots: { date: string; mealTime: MealTime; tabUniqueId: string; menu: Dish[]; userAddressUniqueId?: string; namespace?: string }[],
    history: Omit<HistoricalOrder, 'id'>[],
    prefs: UserPreferences
  ): Promise<PlannedOrder[]> {
    const modePrompt = prefs.planningMode === 'health' 
      ? "Prioritize low calorie, high protein, and balanced macros."
      : prefs.planningMode === 'preference'
      ? "Prioritize favorite restaurants and similar dishes to history."
      : "Balance between health and taste variety.";

    const exclusions = prefs.excludedKeywords.join(", ");
    const weights = JSON.stringify(prefs.vendorWeights);

    // Minimize token usage by mapping menus efficiently
    const slotsPayload = availableSlots.map(slot => ({
      date: slot.date,
      time: slot.mealTime,
      tabId: slot.tabUniqueId,
      options: slot.menu.map(d => ({ id: d.id, name: d.name, restaurant: d.restaurantName, price: d.priceInCent }))
    }));

    // Build history summary for taste analysis
    const historyPayload = history.slice(-60).map(h => ({
      dish: h.dishName,
      restaurant: h.restaurantName,
      date: h.date
    }));

    const prompt = `
      You are an expert dietary planner with taste preference analysis capabilities.
      
      ## STEP 1: Analyze User's Taste Profile (from order history)
      
      Historical Orders (past 4 weeks):
      ${JSON.stringify(historyPayload)}
      
      Based on this history, identify:
      1. Most frequently ordered dish types/ingredients (e.g., beef, chicken, fish, vegetarian)
      2. Favorite restaurants (ordered from most often)
      3. Cuisine preferences (Chinese, Western, Japanese, Korean, etc.)
      4. Typical price range
      5. Any patterns (e.g., prefers lighter meals, likes spicy food)
      
      ## STEP 2: Select ONE dish for each time slot
      
      Available Slots and Menus:
      ${JSON.stringify(slotsPayload)}
      
      Constraints:
      1. Exclude dishes with keywords: [${exclusions}].
      2. Vendor Weights (Higher is better, negative is banned): ${weights}.
      3. Mode: ${modePrompt}
      4. Avoid repeating the same main ingredient twice in a row.
      5. IMPORTANT: Prefer dishes that match the user's taste profile from Step 1.
      
      ## Output Format (Strict JSON Array ONLY)
      IMPORTANT: Return ONLY valid JSON. Keys must be double quoted.
      [
        {
          "date": "YYYY-MM-DD",
          "mealTime": "LUNCH" | "DINNER",
          "dishId": "id_from_options",
          "reason": "基于您的历史偏好：[具体原因]" // Explain in Chinese why this matches their taste
        }
      ]
    `;

    try {
      let rawText = '';

      if (prefs.aiProvider === 'custom') {
        rawText = await this.callCustomAI(prompt + "\n\nEnsure you return ONLY valid JSON. Keys must be double quoted.", prefs);
      } else {
        // Prepare Gemini Client (Use user provided key if available, else generic)
        const activeGenAI = prefs.geminiApiKey 
          ? new GoogleGenAI({ apiKey: prefs.geminiApiKey })
          : this.genAI;

        const model = 'gemini-2.5-flash';
        const response = await activeGenAI.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          }
        });
        rawText = response.text || '';
      }
      
      if (!rawText) throw new Error("Empty response from AI");
      
      // Clean up markdown block if present (Custom AI might add it)
      if (rawText.startsWith('```json')) {
        rawText = rawText.replace(/```json\n?/, '').replace(/```/, '');
      }
      if (rawText.startsWith('```')) {
         rawText = rawText.replace(/```\n?/, '').replace(/```/, '');
      }

      // Sanitize JSON
      let cleanText = rawText.trim();
      cleanText = cleanText.replace(/([{,]\s*)([a-zA-Z0-9_]+?)\s*:/g, '$1"$2":');
      
      const parsed = JSON.parse(cleanText);
      
      // Map back to full objects
      const plans: PlannedOrder[] = [];
      parsed.forEach((p: any) => {
        const slot = availableSlots.find(s => s.date === p.date && s.mealTime === p.mealTime);
        if (slot) {
          // Robust matching for dish ID (handle string vs number mismatch)
          const dish = slot.menu.find(d => String(d.id) === String(p.dishId));
          
          if (dish) {
            plans.push({
              date: p.date,
              mealTime: p.mealTime as MealTime,
              dish,
              reason: p.reason,
              tabUniqueId: slot.tabUniqueId,
              userAddressUniqueId: slot.userAddressUniqueId,
              namespace: slot.namespace
            });
          } else {
             console.warn(`[GeminiService] Dish not found for plan:`, p);
             console.warn(`[GeminiService] Available dishes for ${p.date} ${p.mealTime}:`, slot.menu.map(d => ({ id: d.id, name: d.name })));
          }
        } else {
             console.warn(`[GeminiService] Slot not found for plan:`, p);
        }
      });
      
      return plans;

    } catch (error) {
      console.error("AI Planning Error:", error);
      throw error;
    }
  }

  async analyzeHistory(history: HistoricalOrder[], prefs?: UserPreferences, language: string = 'en'): Promise<AnalysisResult> {
    if (history.length === 0) throw new Error("No history to analyze");

    const promptEn = `
      Analyze the following food order history.
      Input: ${JSON.stringify(history.slice(-30))} (Last 30 orders)
      
      Tasks:
      1. Estimate calories for each meal (approximate based on name).
      2. Analyze cuisine variety.
      3. Give a health score (0-100).
      4. Provide 3 specific improvements.
      
      Output JSON Schema:
      {
        "summary": "String paragraph",
        "score": Number,
        "suggestions": ["String", "String", "String"],
        "calorieTrend": [{"date": "YYYY-MM-DD", "calories": Number}],
        "cuisineDistribution": [{"name": "String", "value": Number}]
      }
    `;

    const promptZh = `
      分析以下饮食订单历史。
      输入: ${JSON.stringify(history.slice(-30))} (最近30个订单)
      
      任务:
      1. 估算每餐的卡路里（根据菜名估算）。
      2. 分析菜系多样性。
      3. 给出一个健康评分 (0-100)。
      4. 提供3个具体的改进建议。
      
      最重要的规则：必须返回标准的 JSON 格式！
      KEY 必须用双引号包裹！例如 "key": "value"。
      不要使用单引号。不要返回 markdown 格式。
      
      输出 JSON 格式示例:
      {
        "summary": "字符串段落",
        "score": 85,
        "suggestions": ["建议1", "建议2", "建议3"],
        "calorieTrend": [{"date": "2023-01-01", "calories": 500}],
        "cuisineDistribution": [{"name": "菜系名", "value": 10}]
      }
    `;

    const prompt = (language === 'zh' || language.startsWith('zh-')) ? promptZh : promptEn + "\nEnsure STRICT JSON format. Keys must be double quoted.";

    try {
      let rawText = '';
      
      if (prefs && prefs.aiProvider === 'custom') {
         rawText = await this.callCustomAI(prompt, prefs);
      } else {
        const activeGenAI = (prefs && prefs.geminiApiKey)
          ? new GoogleGenAI({ apiKey: prefs.geminiApiKey })
          : this.genAI;

        const response = await activeGenAI.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json'
          }
        });
        rawText = response.text || '';
      }

       // Clean up markdown block if present
      if (rawText.startsWith('```json')) {
        rawText = rawText.replace(/```json\n?/, '').replace(/```/, '');
      }
      if (rawText.startsWith('```')) {
         rawText = rawText.replace(/```\n?/, '').replace(/```/, '');
      }

      // Sanitize JSON: Fix unquoted keys and single quotes
      // 1. Replace unquoted keys (e.g. { name: "val" } -> { "name": "val" })
      // 2. Replace single quotes with double quotes for keys/strings if possible (simple heuristic)
      let cleanText = rawText.trim();
      
      // Simple fix for unquoted keys: look for [,{] followed by spacing, then word characters, then colon
      cleanText = cleanText.replace(/([{,]\s*)([a-zA-Z0-9_]+?)\s*:/g, '$1"$2":');

      const result = JSON.parse(cleanText || "{}");
      
      // Attach the model name to the result
      result.modelName = (prefs && prefs.aiProvider === 'custom') 
        ? (prefs.customAiModel || 'Custom Model')
        : 'gemini-2.5-flash';

      return result;
    } catch (e) {
      console.error("Analysis Error", e);
      throw e;
    }
  }
}