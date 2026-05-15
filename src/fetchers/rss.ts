import type { NewsItem } from '../types.js';
import { Temporal } from '@js-temporal/polyfill';
import Parser from 'rss-parser';

const parser = new Parser({
  customFields: {
    item: ['description'],
  },
});

export async function fetchRSS(feedUrl: string, sourceName: string): Promise<NewsItem[]> {
  try {
    const feedRes = await fetch(feedUrl);
    const feedXml = await feedRes.text();
    const feed = await parser.parseString(feedXml);

    const yesterday = Temporal.Now.zonedDateTimeISO().subtract({ days: 1 }).epochMilliseconds;
    const items: NewsItem[] = [];

    for (const item of feed.items) {
      if (item.isoDate && new Date(item.isoDate).getTime() >= yesterday) {
        let snippet = item.contentSnippet || item.content || item.description || '';
        // Truncate snippet to avoid huge context
        if (snippet.length > 500) {
          snippet = `${snippet.substring(0, 500)}...`;
        }

        items.push({
          id: `${sourceName}-${item.guid || item.link || item.title}`,
          source: sourceName,
          title: item.title || 'Untitled',
          url: item.link || feedUrl,
          timestamp: new Date(item.isoDate).getTime(),
          contentSnippet: snippet,
        });
      }
    }

    return items;
  } catch (error) {
    console.error(`Failed to fetch RSS from ${sourceName}:`, error);
    return [];
  }
}

export async function fetchAllRSS(): Promise<NewsItem[]> {
  const [anthropicNews, anthropicEng, openai] = await Promise.all([
    fetchRSS('https://raw.githubusercontent.com/taobojlen/anthropic-rss-feed/refs/heads/main/anthropic_news_rss.xml', 'Anthropic News'),
    fetchRSS('https://raw.githubusercontent.com/taobojlen/anthropic-rss-feed/refs/heads/main/anthropic_engineering_rss.xml', 'Anthropic Engineering'),
    fetchRSS('https://openai.com/news/rss.xml', 'OpenAI'),
  ]);

  return anthropicNews.concat(anthropicEng, openai);
}
