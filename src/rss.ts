import * as cheerio from 'cheerio';

const MAX_ITEMS = 14;
const RSS_PATH = 'news/subscription.rss';

const SKELETON = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Is Frontend Engineering Dead Today</title>
    <description>Daily survival status of Frontend Engineering</description>
  </channel>
</rss>`;

export interface RSSFeedOptions {
  owner: string
  repo: string
  defaultBranch: string
  dateStr: string
}

export function buildRSS(existingXml: string, opts: RSSFeedOptions): string {
  const { owner, repo, defaultBranch, dateStr } = opts;
  const $ = cheerio.load(existingXml || SKELETON, { xml: true });
  const channel = $('channel');

  // Ensure channel metadata
  if (!channel.find('link').length)
    channel.find('description').before('<link/>');
  channel.find('link').text(`https://github.com/${owner}/${repo}`);

  // Build new item
  const [yyyy, MM, dd] = dateStr.split('-');
  const link = `https://github.com/${owner}/${repo}/blob/${defaultBranch}/news/${yyyy}/${MM}/${dd}.md`;

  const item = cheerio.load('<item/>', { xml: true })('item');
  item.append(`<title>${dateStr}</title>`);
  item.append(`<link>${link}</link>`);
  item.append(`<guid isPermaLink="true">${link}</guid>`);
  item.append(`<pubDate>${new Date(`${dateStr}T00:00:00Z`).toUTCString()}</pubDate>`);

  // Prepend new item, trim to MAX_ITEMS
  channel.find('item').first().before(item);
  channel.find('item').slice(MAX_ITEMS).remove();

  return $.xml();
}

export { RSS_PATH };
