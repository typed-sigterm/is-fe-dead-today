import type { NewsItem } from '../types.js';
import { Temporal } from '@js-temporal/polyfill';

export async function fetchHN(): Promise<NewsItem[]> {
  const topStoriesRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
  const storyIds = (await topStoriesRes.json()) as number[];

  const yesterday = Temporal.Now.zonedDateTimeISO().subtract({ days: 1 }).epochMilliseconds / 1000;

  const items: NewsItem[] = [];

  // Fetch top 100 stories to ensure we get enough from the last 24h
  const promises = storyIds.slice(0, 100).map(async (id) => {
    try {
      const res = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
      return (await res.json()) as any;
    } catch {
      return null;
    }
  });

  const stories = await Promise.all(promises);

  for (const story of stories) {
    if (story && story.time >= yesterday && story.type === 'story') {
      items.push({
        id: `hn-${story.id}`,
        source: 'HackerNews',
        title: story.title,
        url: story.url || `https://news.ycombinator.com/item?id=${story.id}`,
        timestamp: story.time * 1000,
      });
    }
  }

  return items;
}
