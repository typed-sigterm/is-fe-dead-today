import type { NewsItem } from '../utils.js';
import { Octokit } from 'octokit';

const REPO_OWNER = 'imjuya';
const REPO_NAME = 'juya-ai-daily';
const AUTHOR_ID = 204206495;

function extractOverviewItems(body: string, issueUrl: string): NewsItem[] | undefined {
  const start = body.indexOf('## 概览');
  if (start === -1)
    return undefined;

  const afterStart = body.slice(start + '## 概览'.length);
  const endMatch = afterStart.match(/\n## \[|\n---/);
  const overview = endMatch ? afterStart.slice(0, endMatch.index) : afterStart;

  const items: NewsItem[] = [];
  let currentCategory = '';
  let currentTitle = '';
  let currentLink = '';

  for (const line of overview.split('\n')) {
    const trimmed = line.trim();

    // Category header: ### 要闻 / ### 模型发布 / ...
    const catMatch = trimmed.match(/^###\s+(.+)/);
    if (catMatch) {
      currentCategory = catMatch[1]!;
      continue;
    }

    // Title line: - Title text
    const titleMatch = trimmed.match(/^-\s+(.+)/);
    if (titleMatch) {
      // If we already have a pending item, flush it
      if (currentTitle) {
        items.push({
          id: `juya-overview-${items.length}`,
          source: `juya-ai-daily · ${currentCategory}`,
          title: currentTitle,
          url: currentLink || issueUrl,
          timestamp: 0,
        });
      }
      currentTitle = titleMatch[1]!;
      currentLink = '';
      continue;
    }

    // Link line: [↗](url) `#n`
    const linkMatch = trimmed.match(/\[↗\]\(([^)]+)\)/);
    if (linkMatch && currentTitle) {
      currentLink = linkMatch[1]!;
      items.push({
        id: `juya-overview-${items.length}`,
        source: `juya-ai-daily · ${currentCategory}`,
        title: currentTitle,
        url: currentLink,
        timestamp: 0,
      });
      currentTitle = '';
      currentLink = '';
    }
  }

  // Flush remaining item (if title has inline link or no link line)
  if (currentTitle) {
    items.push({
      id: `juya-overview-${items.length}`,
      source: `juya-ai-daily · ${currentCategory}`,
      title: currentTitle,
      url: currentLink || issueUrl,
      timestamp: 0,
    });
  }

  return items.length > 0 ? items : undefined;
}

export async function fetchJuyaAIDaily(): Promise<NewsItem[]> {
  const octokit = new Octokit();
  const { data: issues } = await octokit.rest.issues.listForRepo({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    sort: 'created',
    direction: 'desc',
    per_page: 10,
  });

  const issue = issues.find(i => i.user?.id === AUTHOR_ID);
  if (!issue)
    return [];

  const body = issue.body ?? '';
  const items = extractOverviewItems(body, issue.html_url);
  if (items)
    return items;

  // Fallback: return the whole body as a single item
  let snippet = body;
  if (snippet.length > 500)
    snippet = `${snippet.substring(0, 500)}...`;

  return [{
    id: `juya-${issue.number}`,
    source: 'juya-ai-daily',
    title: issue.title,
    url: issue.html_url,
    timestamp: new Date(issue.created_at).getTime(),
    contentSnippet: snippet,
  }];
}
