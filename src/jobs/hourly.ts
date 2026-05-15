import { validateEnv } from '../env.js';
import { mergeOldPRs } from '../github.js';

async function main() {
  const env = validateEnv();
  const owner = env.GITHUB_REPOSITORY?.split('/')[0];
  const repo = env.GITHUB_REPOSITORY?.split('/')[1];

  if (!owner || !repo) {
    console.warn('GITHUB_REPOSITORY not set. Cannot run merge script.');
    return;
  }

  console.log(`Checking for old PRs in ${owner}/${repo}...`);
  await mergeOldPRs(owner, repo);
  console.log('Done.');
}

main().catch(console.error);
