import { Buffer } from 'node:buffer';
import process from 'node:process';
import { createAppAuth } from '@octokit/auth-app';
import { Octokit, RequestError } from 'octokit';
import { generateRSS, RSS_PATH } from './rss.js';

let _appOctokit: Octokit | undefined;
let _installationOctokit: Octokit | undefined;

export function getAppOctokit() {
  if (_appOctokit)
    return _appOctokit;
  return _appOctokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: process.env.APP_CLIENT_ID,
      privateKey: process.env.APP_PRIVATE_KEY,
    },
  });
}

export async function getInstallationOctokit(): Promise<Octokit> {
  if (_installationOctokit)
    return _installationOctokit;

  const owner = process.env.GITHUB_REPOSITORY?.split('/')[0];
  const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];

  if (!owner || !repo)
    throw new Error('GITHUB_REPOSITORY must be set');

  const { data: installation } = await getAppOctokit().rest.apps.getRepoInstallation({ owner, repo });

  return _installationOctokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: process.env.APP_CLIENT_ID,
      privateKey: process.env.APP_PRIVATE_KEY,
      installationId: installation.id,
    },
  });
}

export async function createNewsPR(owner: string, repo: string, markdown: string, dateStr: string, yyyy: string, MM: string, dd: string) {
  const octokit = await getInstallationOctokit();
  const branchName = `news/${dateStr}`;

  // 1. Get default branch
  const { data: repository } = await octokit.rest.repos.get({ owner, repo });
  const defaultBranch = repository.default_branch;
  const { data: defaultRef } = await octokit.rest.git.getRef({ owner, repo, ref: `heads/${defaultBranch}` });

  // 2. Create branch (idempotent)
  try {
    await octokit.rest.git.createRef({ owner, repo, ref: `refs/heads/${branchName}`, sha: defaultRef.object.sha });
  } catch (err) {
    if (err instanceof RequestError && err.status !== 422)
      throw err;
  }

  // 3. Get branch HEAD
  const { data: branchRef } = await octokit.rest.git.getRef({ owner, repo, ref: `heads/${branchName}` });
  const { data: headCommit } = await octokit.rest.git.getCommit({ owner, repo, commit_sha: branchRef.object.sha });

  // 4. Create blobs for news + RSS in parallel
  const newsPath = `news/${yyyy}/${MM}/${dd}.md`;
  const rssContent = generateRSS({ owner, repo, defaultBranch });
  const [newsBlob, rssBlob] = await Promise.all([
    octokit.rest.git.createBlob({ owner, repo, content: Buffer.from(markdown).toString('base64'), encoding: 'base64' }),
    octokit.rest.git.createBlob({ owner, repo, content: Buffer.from(rssContent).toString('base64'), encoding: 'base64' }),
  ]);

  // 5. Create tree, commit, update ref — single commit
  const { data: tree } = await octokit.rest.git.createTree({
    owner,
    repo,
    base_tree: headCommit.tree.sha,
    tree: [
      { path: newsPath, mode: '100644', type: 'blob', sha: newsBlob.data.sha },
      { path: RSS_PATH, mode: '100644', type: 'blob', sha: rssBlob.data.sha },
    ],
  });
  const { data: commit } = await octokit.rest.git.createCommit({
    owner,
    repo,
    message: `news: ${dateStr}`,
    tree: tree.sha,
    parents: [branchRef.object.sha],
  });
  await octokit.rest.git.updateRef({ owner, repo, ref: `heads/${branchName}`, sha: commit.sha });

  // 6. Create PR
  try {
    const { data: pr } = await octokit.rest.pulls.create({
      owner,
      repo,
      title: `news: ${dateStr}`,
      head: branchName,
      base: defaultBranch,
    });
    await octokit.rest.issues.addLabels({ owner, repo, issue_number: pr.number, labels: ['news publishing'] });
    return pr;
  } catch (err) {
    if (err instanceof RequestError && err.status !== 422)
      throw err;
    console.log(`PR for ${branchName} might already exist or there was a validation error`);
  }
}

export async function mergeOldPRs(owner: string, repo: string) {
  const octokit = await getInstallationOctokit();

  const { data: pulls } = await octokit.rest.pulls.list({
    owner,
    repo,
    state: 'open',
  });

  const now = Date.now();
  const SIX_HOURS = 6 * 60 * 60 * 1000;

  for (const pr of pulls) {
    const hasLabel = pr.labels.some(l => l.name === 'news publishing');
    if (!hasLabel)
      continue;

    const createdAt = new Date(pr.created_at).getTime();
    if (now - createdAt >= SIX_HOURS) {
      try {
        console.log(`Merging PR #${pr.number}`);
        await octokit.rest.pulls.merge({
          owner,
          repo,
          pull_number: pr.number,
          merge_method: 'squash',
        });
        await octokit.rest.git.deleteRef({
          owner,
          repo,
          ref: `heads/${pr.head.ref}`,
        });
      } catch (e) {
        console.error(`Failed to merge PR #${pr.number}:`, e);
      }
    }
  }
}
