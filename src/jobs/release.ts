import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { validateEnv } from '../env.js';
import { getInstallationOctokit } from '../github.js';

async function main() {
  const env = validateEnv();
  const owner = env.GITHUB_REPOSITORY?.split('/')[0];
  const repo = env.GITHUB_REPOSITORY?.split('/')[1];
  const prNumber = env.PR_NUMBER;

  if (!owner || !repo || !prNumber) {
    console.warn('GITHUB_REPOSITORY or PR_NUMBER not set.');
    return;
  }

  const octokit = await getInstallationOctokit();

  const { data: pr } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: Number.parseInt(prNumber),
  });

  // Validate label
  if (!pr.labels.some(l => l.name === 'news publishing')) {
    console.log('PR does not have news publishing label. Skipping release.');
    return;
  }

  if (!pr.merged) {
    console.log('PR is not merged. Skipping release.');
    return;
  }

  // Branch format is expected to be news/yyyy-MM-dd
  const branchName = pr.head.ref;
  if (!branchName.startsWith('news/')) {
    console.log(`Branch name ${branchName} does not start with news/`);
    return;
  }

  const tag = branchName.replace('news/', '');
  console.log(`Creating tag and release for ${tag}...`);

  // 1. Create Tag Object
  const { data: tagRef } = await octokit.rest.git.createTag({
    owner,
    repo,
    tag,
    message: `Release ${tag}`,
    object: pr.merge_commit_sha as string,
    type: 'commit',
    tagger: {
      name: 'is-fe-dead-today[bot]',
      email: '3725737+is-fe-dead-today[bot]@users.noreply.github.com',
      date: new Date().toISOString(),
    },
  });

  // 2. Create Reference
  await octokit.rest.git.createRef({
    owner,
    repo,
    ref: `refs/tags/${tag}`,
    sha: tagRef.sha,
  });

  // 3. Create Release mapping to discussion category if possible
  const body = (await readFile(
    path.resolve(import.meta.dirname, `../../news/${tag.replaceAll('-', '/')}.md`),
  )).toString();
  await octokit.rest.repos.createRelease({
    owner,
    repo,
    tag_name: tag,
    name: tag,
    body,
    discussion_category_name: 'Updates',
  });

  console.log(`Successfully created release ${tag}`);
}

main().catch(console.error);
