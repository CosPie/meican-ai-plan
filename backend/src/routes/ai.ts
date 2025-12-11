import { Hono } from 'hono';
import OpenAI from 'openai';

const ai = new Hono();

ai.post('/chat', async (c) => {
  try {
    const { baseUrl, apiKey, model, messages } = await c.req.json();

    if (!baseUrl || !apiKey || !messages) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Initialize OpenAI client with custom settings
    // Note: baseURL should be the base API URL (e.g., "https://api.openai.com/v1")
    // The SDK will automatically append "/chat/completions" for chat requests
    const openai = new OpenAI({
      apiKey: apiKey,
      baseURL: baseUrl,
    });

    console.log(`[AI Proxy] Forwarding request to ${baseUrl} with model ${model}`);

    const completion = await openai.chat.completions.create({
      model: model || 'gpt-3.5-turbo',
      messages: messages,
      temperature: 0.7,
    });

    return c.json(completion);

  } catch (error: any) {
    console.error('[AI Proxy] Error:', error);
    // Handle OpenAI specific errors better if possible, but generic catch is fine for now
    return c.json({ 
      error: 'AI Provider Error', 
      details: error.message || error 
    }, 500);
  }
});

export default ai;
