import OpenAI from 'openai';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const client = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY,
});

export interface ParsedQuery {
  keywords: string[];
  mustInclude: string[];
  mustExclude: string[];
  reply: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query } = req.body as { query?: string };

  if (!query?.trim()) {
    return res.status(400).json({ error: 'Query is required' });
  }

  try {
    const completion = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: `You are a recipe search assistant for a Middle Eastern and Mediterranean food blog.
Extract structured search parameters from the user's natural language query.

Respond ONLY with valid JSON in this exact format:
{
  "keywords": ["word1", "word2"],
  "mustInclude": ["ingredient1"],
  "mustExclude": ["ingredient2"],
  "reply": "A warm, friendly one-sentence response acknowledging what you're searching for"
}

Rules:
- keywords: key terms to drive semantic search (ingredients, dish names, cooking methods, meal types)
- mustInclude: ingredients that MUST appear in results (only if user is very specific)
- mustExclude: ingredients that must NOT appear (allergies, preferences like "no meat")
- reply: conversational, friendly — e.g. "Let me find you some quick breakfast ideas!"
- Keep keywords focused and relevant, 2-6 words max
- If the user mentions time (e.g. "under 10 minutes"), add "quick" or "simple" to keywords`,
        },
        {
          role: 'user',
          content: query,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 200,
    });

    const raw = completion.choices[0].message.content ?? '{}';
    const result = JSON.parse(raw) as ParsedQuery;

    // Ensure all fields exist with safe defaults
    return res.status(200).json({
      keywords: result.keywords ?? [],
      mustInclude: result.mustInclude ?? [],
      mustExclude: result.mustExclude ?? [],
      reply: result.reply ?? `Searching for "${query}"...`,
    } satisfies ParsedQuery);
  } catch (err) {
    console.error('DeepSeek API error:', err);
    return res.status(500).json({ error: 'Failed to parse query' });
  }
}
