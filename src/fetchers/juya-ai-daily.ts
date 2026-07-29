import type { NewsItem } from '../utils.js';
import { Temporal } from '@js-temporal/polyfill';

const BASE_URL = 'https://daily.juya.uk/markdown';

function extractOverviewItems(body: string, pageUrl: string): NewsItem[] | undefined {
  const start = body.indexOf('## 概览');
  if (start === -1)
    return undefined;

  const afterStart = body.slice(start + '## 概览'.length);
  const endMatch = afterStart.match(/\n## \[|\n---/);
  const overview = endMatch ? afterStart.slice(0, endMatch.index) : afterStart;

  const items: NewsItem[] = [];
  let currentCategory = '';

  for (const line of overview.split('\n')) {
    const trimmed = line.trim();

    // Category header: ### 要闻 / ### 模型发布 / ...
    const catMatch = trimmed.match(/^###\s+(.+)/);
    if (catMatch) {
      currentCategory = catMatch[1]!;
      continue;
    }

    // Item line: - Title text [↗](url) `#n`
    const itemMatch = trimmed.match(/^-\s+(.+)/);
    if (itemMatch) {
      const raw = itemMatch[1]!;
      const linkMatch = raw.match(/\[↗\]\(([^)]+)\)/);
      const title = raw
        .replace(/\s*\[↗\]\([^)]+\)/, '')
        .replace(/\s*`#\d+`\s*$/, '')
        .trim();
      items.push({
        id: `juya-overview-${items.length}`,
        source: `juya-ai-daily · ${currentCategory}`,
        title,
        url: linkMatch?.[1] ?? pageUrl,
        timestamp: 0,
      });
    }
  }

  return items.length > 0 ? items : undefined;
}

async function fetchMarkdown(date: string): Promise<{ body: string, url: string } | undefined> {
  const url = `${BASE_URL}/${date}.md`;
  const res = await fetch(url);
  if (!res.ok)
    return undefined;
  return { body: await res.text(), url };
}

export async function fetchJuyaAIDaily(): Promise<NewsItem[]> {
  const now = Temporal.Now.zonedDateTimeISO();
  // Today's daily may not be published yet; fall back to yesterday
  const result = await fetchMarkdown(now.toPlainDate().toString())
    ?? await fetchMarkdown(now.toPlainDate().subtract({ days: 1 }).toString());
  if (!result)
    return [];

  const { body, url } = result;
  const items = extractOverviewItems(body, url);
  if (items)
    return items;

  // Fallback: return the whole body as a single item
  let snippet = body;
  if (snippet.length > 500)
    snippet = `${snippet.substring(0, 500)}...`;

  const titleMatch = body.match(/^#\s+(.+)/m);

  return [{
    id: `juya-${url}`,
    source: 'juya-ai-daily',
    title: titleMatch?.[1] ?? 'juya-ai-daily',
    url,
    timestamp: Date.now(),
    contentSnippet: snippet,
  }];
}
