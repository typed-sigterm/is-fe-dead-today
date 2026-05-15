import process from 'node:process';
import { getInstallationOctokit } from '../github.js';

async function main() {
  const owner = process.env.GITHUB_REPOSITORY?.split('/')[0];
  const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];
  const prNumber = process.env.PR_NUMBER;

  if (!owner || !repo || !prNumber) {
    console.warn('GITHUB_REPOSITORY or PR_NUMBER not set.');
    return;
  }

  const octokit = await getInstallationOctokit();

  const { data: pr } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: Number.parseInt(prNumber, 10),
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

  const dateStr = branchName.replace('news/', '');
  const tag = dateStr;

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
  // NOTE: For discussion_category_name you need the exact category name (e.g. 'General' or 'Announcements').
  // We'll omit it so it just generates a release, unless specified.
  await octokit.rest.repos.createRelease({
    owner,
    repo,
    tag_name: tag,
    name: tag,
    body: pr.body || `Daily FE news for ${tag}`,
    draft: false,
    prerelease: false,
    generate_release_notes: true,
    // discussion_category_name: "Announcements" // Uncomment and configure if a specific category is set up
  });

  console.log(`Successfully created release ${tag}`);
}

main().catch(console.error);
