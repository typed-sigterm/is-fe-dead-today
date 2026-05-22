import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export interface NewsItem {
  id: string
  source: string
  title: string
  url: string
  timestamp: number
  contentSnippet?: string
}

export async function fileExists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function readLocalNews(date: string) {
  const [yyyy, MM, dd] = date.split('-');
  const path = resolve(import.meta.dirname, `../news/${yyyy}/${MM}/${dd}.md`);
  return (await readFile(path, 'utf-8')).toString();
}
