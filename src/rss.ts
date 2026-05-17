import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Temporal } from '@js-temporal/polyfill';
import * as cheerio from 'cheerio';

const MAX_ITEMS = 14;
const RSS_PATH = 'news/subscription.rss';
const NEWS_DIR = resolve(import.meta.dirname, '..', 'news');

export function generateRSS(): string {
  const now = Temporal.Now.zonedDateTimeISO();

  const $ = cheerio.load('<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel></channel></rss>', { xml: true });
  const channel = $('channel');

  channel.append('<title>Is Frontend Engineering Dead Today</title>');
  channel.append('<description>Daily survival status of Frontend Engineering</description>');
  channel.append(`<link>https://is-frontend-dead-today.by-ts.top</link>`);

  for (let i = 0; i < MAX_ITEMS; i++) {
    const date = now.subtract({ days: i });
    const yyyy = String(date.year);
    const MM = String(date.month).padStart(2, '0');
    const dd = String(date.day).padStart(2, '0');
    const dateStr = `${yyyy}-${MM}-${dd}`;

    const filePath = resolve(NEWS_DIR, yyyy, MM, `${dd}.md`);
    if (!existsSync(filePath))
      continue;

    const link = `https://is-frontend-dead-today.by-ts.top/news/${yyyy}/${MM}/${dd}`;
    const pubDate = new Date(`${dateStr}T00:00:00Z`).toUTCString();

    const $item = cheerio.load('<item/>', { xml: true });
    const item = $item('item');
    item.append($item('<title>').text(dateStr));
    item.append($item('<link>').text(link));
    item.append($item('<guid>').attr('isPermaLink', 'true').text(link));
    item.append($item('<pubDate>').text(pubDate));

    channel.append(item);
  }

  return $.xml();
}

export { RSS_PATH };
