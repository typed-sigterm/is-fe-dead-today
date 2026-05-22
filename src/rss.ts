import { resolve } from 'node:path';
import { Temporal } from '@js-temporal/polyfill';
import * as cheerio from 'cheerio';
import xmlFormat from 'xml-formatter';
import { fileExists, readLocalNews } from './utils.js';

const MAX_ITEMS = 14;
export const RSS_PATH = 'news/subscription.rss';
const NEWS_DIR = resolve(import.meta.dirname, '../news');

export async function generateRSS(): Promise<string> {
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
    if (!await fileExists(filePath))
      continue;

    const link = `http://github.com/typed-sigterm/is-fe-dead-today/releases/tag/${dateStr}`;
    const content = await readLocalNews(dateStr);
    const title = content.startsWith('Frontend Engineering is dead today')
      ? `Frontend Engineering is dead on ${dateStr}`
      : content.startsWith('Frontend Engineering is alive today')
        ? `Frontend Engineering is alive on ${dateStr}`
        : `Survival status of Frontend Engineering on ${dateStr}`;

    const $item = cheerio.load('<item/>', { xml: true });
    const item = $item('item');
    item.append($item('<title>').text(title));
    item.append($item('<link>').text(link));
    item.append($item('<guid>').attr('isPermaLink', 'true').text(link));

    channel.append(item);
  }

  // eslint-disable-next-line prefer-template
  return xmlFormat($.xml(), {
    indentation: '  ',
    lineSeparator: '\n',
  }) + '\n';
}
