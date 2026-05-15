import type { NewsItem } from './types.js';
import { OpenRouter } from '@openrouter/agent';
import { tool } from '@openrouter/agent/tool';
import * as cheerio from 'cheerio';
import { z } from 'zod';
import instructions from './agent.prompt.md' with { type: 'text' };
import { validateEnv } from './env.js';

const env = validateEnv();

const client = new OpenRouter({
  apiKey: env.OPENROUTER_API_KEY,
  httpReferer: 'https://is-fe-dead-today.by-ts.top',
  appTitle: 'Is Frontend Engineering Dead Today',
  appCategories: 'personal-agent',
});

// Tool to read the full content of an article
const readArticleTool = tool({
  name: 'read_article',
  description: 'Fetches the full text content of an article or news item to help you decide if it impacts frontend engineering.',
  inputSchema: z.object({
    url: z.url(),
  }),
  execute: async ({ url }) => {
    console.log(`Fetching article content from: ${url}`);
    try {
      const res = await fetch(url);
      const text = await res.text();
      const $ = cheerio.load(text);
      $('script, style, nav, footer, header').remove();
      return $('body').text().replace(/\s+/g, ' ').trim().substring(0, 5000);
    } catch {
      return `Failed to fetch URL: ${url}`;
    }
  },
});

export async function runAgent(items: NewsItem[]): Promise<string> {
  const input = items.map(item => `Source: ${item.source}
Title: ${item.title}
URL: ${item.url}
Snippet: ${item.contentSnippet || 'No snippet available'}
---`).join('\n');

  console.log(`Sending ${items.length} items to the agent...`);

  const result = client.callModel({
    model: 'google/gemini-3.1-flash-lite',
    instructions,
    input,
    tools: [readArticleTool],
  });

  const text = await result.getText();
  return text;
}
