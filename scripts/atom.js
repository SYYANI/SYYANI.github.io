function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function cdata(value) {
  return `<![CDATA[${String(value || '').replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
}

function toIsoDate(value) {
  if (!value) return new Date().toISOString();
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function toAbsoluteUrl(siteUrl, rootPath, routePath) {
  const base = new URL(rootPath || '/', siteUrl);
  return new URL(String(routePath || '').replace(/^\//, ''), base).toString();
}

function collectPosts(postsModel, limit) {
  const posts = [];
  if (!postsModel || typeof postsModel.sort !== 'function') return posts;

  postsModel
    .sort('-date')
    .limit(limit)
    .each((post) => {
      posts.push(post);
    });

  return posts;
}

function collectTags(post) {
  const tags = [];
  if (!post || !post.tags || typeof post.tags.each !== 'function') return tags;

  post.tags.each((tag) => {
    tags.push(tag.name);
  });

  return tags;
}

hexo.extend.generator.register('atom-feed', function atomFeedGenerator(locals) {
  const feedConfig = Object.assign(
    {
      path: 'atom.xml',
      limit: 20,
    },
    hexo.config.feed || {}
  );

  const routePath = String(feedConfig.path || 'atom.xml').replace(/^\/+/, '');
  const limit = Number(feedConfig.limit) > 0 ? Number(feedConfig.limit) : 20;
  const posts = collectPosts(locals.posts, limit);
  const siteUrl = hexo.config.url || 'http://localhost';
  const siteRoot = hexo.config.root || '/';
  const siteLink = toAbsoluteUrl(siteUrl, siteRoot, '');
  const feedLink = toAbsoluteUrl(siteUrl, siteRoot, routePath);
  const updatedAt = posts[0] ? toIsoDate(posts[0].updated || posts[0].date) : new Date().toISOString();
  const subtitle = hexo.config.description || hexo.config.subtitle || '';
  const author = hexo.config.author || hexo.config.title || 'Hexo';

  const entries = posts
    .map((post) => {
      const permalink = post.permalink || toAbsoluteUrl(siteUrl, siteRoot, post.path);
      const summary = post.excerpt || post.content || '';
      const content = post.content || '';
      const tags = collectTags(post)
        .map((tag) => `    <category term="${escapeXml(tag)}" />`)
        .join('\n');

      return [
        '  <entry>',
        `    <title>${cdata(post.title || permalink)}</title>`,
        `    <link href="${escapeXml(permalink)}" />`,
        `    <id>${escapeXml(permalink)}</id>`,
        `    <published>${toIsoDate(post.date)}</published>`,
        `    <updated>${toIsoDate(post.updated || post.date)}</updated>`,
        tags,
        summary ? `    <summary type="html">${cdata(summary)}</summary>` : '',
        content ? `    <content type="html">${cdata(content)}</content>` : '',
        '  </entry>',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');

  const xml = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    `  <title>${cdata(hexo.config.title || 'Hexo')}</title>`,
    `  <id>${escapeXml(feedLink)}</id>`,
    `  <link href="${escapeXml(siteLink)}" />`,
    `  <link href="${escapeXml(feedLink)}" rel="self" />`,
    `  <updated>${updatedAt}</updated>`,
    `  <author><name>${cdata(author)}</name></author>`,
    '  <generator uri="https://hexo.io/">Hexo</generator>',
    subtitle ? `  <subtitle>${cdata(subtitle)}</subtitle>` : '',
    entries,
    '</feed>',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    path: routePath,
    data: xml,
  };
});
