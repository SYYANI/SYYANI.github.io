import { Octokit } from '@octokit/rest';
import { outputFile } from 'fs-extra';
import { basename, join, resolve } from 'path';
import { DateTime } from 'luxon';

const octokit = new Octokit({
  auth: process.env.GH_TOKEN,
});

const baseOpts = {
  owner: process.env.GH_REPO.split('/')[0],
  repo: process.env.GH_REPO.split('/')[1],
};

console.log(`Sync posts from ${process.env.GH_REPO}`);

let issues = [];
let page = 1;
while (true) {
  console.log(`Fetching issues page ${page}...`);
  const { data } = await octokit.rest.issues.listForRepo({
    ...baseOpts,
    per_page: 100,
    page: page++,
    state: 'closed',
  });
  if (data.length == 0) break;
  issues = [...issues, ...data];
}
console.log(`Fetched ${issues.length} posts`);

const postsDir = resolve('source', '_posts');
for (const issue of issues) {
  const frontMatter = JSON.stringify({
    title: issue.title,
    date: DateTime.fromISO(issue.created_at).toFormat('y/M/d HH:mm:ss'),
    tags: issue.labels.map(({ name }) => name),
  });

  const path = join(postsDir, `issue-${issue.number}.md`);
  const content = `${frontMatter.substring(1, frontMatter.length - 1)}\n;;;\n${issue.body}`;
  await outputFile(path, content);
  console.log(`Generated ${basename(path)}`);
}

console.log('Done!');
