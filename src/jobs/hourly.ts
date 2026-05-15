import process from 'node:process';
import { mergeOldPRs } from '../github.js';

async function main() {
  const owner = process.env.GITHUB_REPOSITORY?.split('/')[0];
  const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];

  if (!owner || !repo) {
    console.warn('GITHUB_REPOSITORY not set. Cannot run merge script.');
    return;
  }

  console.log(`Checking for old PRs in ${owner}/${repo}...`);
  await mergeOldPRs(owner, repo);
  console.log('Done.');
}

main().catch(console.error);
