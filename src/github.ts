import { Buffer } from 'node:buffer';
import process from 'node:process';
import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from 'octokit';

let _appOctokit: Octokit | undefined;
let _installationOctokit: Octokit | undefined;

export function getAppOctokit() {
  if (_appOctokit)
    return _appOctokit;

  const privateKey = process.env.APP_PRIVATE_KEY;
  const appId = process.env.APP_CLIENT_ID;

  if (!privateKey || !appId)
    throw new Error('APP_PRIVATE_KEY and APP_CLIENT_ID must be set');

  return _appOctokit = new Octokit({
    authStrategy: createAppAuth,
    auth: { appId, privateKey },
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
      appId: process.env.APP_CLIENT_ID!,
      privateKey: process.env.APP_PRIVATE_KEY!,
      installationId: installation.id,
    },
  });
}

export async function createNewsPR(owner: string, repo: string, markdown: string, dateStr: string, yyyy: string, MM: string, dd: string) {
  const octokit = await getInstallationOctokit();
  const branchName = `news/${dateStr}`;

  // 1. Get default branch sha
  const { data: repository } = await octokit.rest.repos.get({ owner, repo });
  const defaultBranch = repository.default_branch;
  const { data: ref } = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: `heads/${defaultBranch}`,
  });

  // 2. Create branch
  try {
    await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: ref.object.sha,
    });
  } catch (err: any) {
    if (err.status !== 422)
      throw err; // Ignore if branch exists
  }

  // 3. Create or update file
  const path = `news/${yyyy}/${MM}/${dd}.md`;
  let sha: string | undefined;

  try {
    const { data: file } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref: branchName,
    });
    if (!Array.isArray(file)) {
      sha = file.sha;
    }
  } catch (err: any) {
    if (err.status !== 404)
      throw err;
  }

  await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message: `news: ${dateStr}`,
    content: Buffer.from(markdown).toString('base64'),
    branch: branchName,
    sha,
    committer: {
      name: 'is-fe-dead-today[bot]',
      email: '3725737+is-fe-dead-today[bot]@users.noreply.github.com',
    },
    author: {
      name: 'is-fe-dead-today[bot]',
      email: '3725737+is-fe-dead-today[bot]@users.noreply.github.com',
    },
  });

  // 4. Create PR
  try {
    const { data: pr } = await octokit.rest.pulls.create({
      owner,
      repo,
      title: `news: ${dateStr}`,
      head: branchName,
      base: defaultBranch,
      body: `Auto-generated news for ${dateStr}`,
    });

    // 5. Add label
    await octokit.rest.issues.addLabels({
      owner,
      repo,
      issue_number: pr.number,
      labels: ['news publishing'],
    });

    return pr;
  } catch (err: any) {
    // If PR already exists, it might throw a 422
    if (err.status !== 422)
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
    const hasLabel = pr.labels.some((l: any) => l.name === 'news publishing');
    if (!hasLabel)
      continue;

    const createdAt = new Date(pr.created_at).getTime();
    if (now - createdAt >= SIX_HOURS) {
      console.log(`Merging PR #${pr.number}`);
      await octokit.rest.pulls.merge({
        owner,
        repo,
        pull_number: pr.number,
        merge_method: 'squash',
      });
    }
  }
}
