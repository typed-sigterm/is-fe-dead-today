import { existsSync } from 'node:fs';
import process from 'node:process';
import { Temporal } from '@js-temporal/polyfill';
import { runAgent } from '../agent.js';
import { fetchHN } from '../fetchers/hn.js';
import { fetchJuyaAIDaily } from '../fetchers/juya-ai-daily.js';
import { fetchAllRSS } from '../fetchers/rss.js';
import { createNewsPR } from '../github.js';

async function main() {
  const now = Temporal.Now.zonedDateTimeISO();
  const yyyy = String(now.year);
  const MM = String(now.month).padStart(2, '0');
  const dd = String(now.day).padStart(2, '0');
  const dateStr = `${yyyy}-${MM}-${dd}`;

  if (existsSync(`news/${yyyy}/${MM}/${dd}.md`)) {
    console.log(`news/${yyyy}/${MM}/${dd}.md already exists. Skipping.`);
    return;
  }

  console.log('Fetching news...');
  const items = (await Promise.all([
    fetchHN(),
    fetchAllRSS(),
    fetchJuyaAIDaily(),
  ])).flat();
  items.sort((a, b) => b.timestamp - a.timestamp);
  console.log(`Found ${items.length} items from the last 24 hours.`);

  const markdownReport = await runAgent(items.slice(0, 100)); // prevent payload from being too crazy

  const owner = process.env.GITHUB_REPOSITORY?.split('/')[0];
  const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];

  if (!owner || !repo) {
    console.warn('GITHUB_REPOSITORY not set. Skipping PR creation.');
    console.log(markdownReport);
    return;
  }

  console.log(`Creating PR for ${dateStr}...`);
  await createNewsPR(owner, repo, markdownReport, dateStr, yyyy, MM, dd);
}

main().catch(console.error);
