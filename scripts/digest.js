const fs = require('fs');
const moment = require('moment');
const path = require('path');

const DEFAULT_DIGEST_ROOT = path.resolve(__dirname, '..', '..', 'digest', 'content', 'digest');
const DIGEST_ROOT = path.resolve(process.env.DIGEST_CONTENT_DIR || DEFAULT_DIGEST_ROOT);

function walkFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
      continue;
    }
    files.push(fullPath);
  }

  return files;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripMarkdown(text) {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^>\s?/gm, '')
    .replace(/[#*_~>-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseTomlValue(rawValue) {
  const value = rawValue.trim();

  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return inner
      .split(',')
      .map((item) => item.trim())
      .map((item) => parseTomlValue(item));
  }

  if (
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith('"') && value.endsWith('"'))
  ) {
    return value.slice(1, -1);
  }

  if (value === 'true') return true;
  if (value === 'false') return false;

  const numericValue = Number(value);
  if (!Number.isNaN(numericValue)) return numericValue;

  return value;
}

function parseDigestFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const match = raw.match(/^\+\+\+\s*\n([\s\S]*?)\n\+\+\+\s*\n?([\s\S]*)$/);
  const frontMatter = {};
  let body = raw;

  if (match) {
    body = match[2];
    const frontMatterLines = match[1].split('\n');
    for (const line of frontMatterLines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex === -1) continue;

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();
      frontMatter[key] = parseTomlValue(value);
    }
  }

  return { frontMatter, body };
}

function toRoutePath(relativePath) {
  const normalized = relativePath.split(path.sep).join('/');
  if (normalized.endsWith('/index.md')) {
    return `digest/${normalized.slice(0, -'index.md'.length)}index.html`;
  }

  if (normalized.endsWith('.md')) {
    return `digest/${normalized.slice(0, -3)}/index.html`;
  }

  return `digest/${normalized}`;
}

function formatDateLabel(date) {
  if (!date || typeof date.format !== 'function') return '';
  return date.format('YYYY-MM-DD');
}

hexo.extend.generator.register('digest-pages', function digestPages(locals) {
  if (!fs.existsSync(DIGEST_ROOT)) {
    hexo.log.warn(`[digest] content directory not found: ${DIGEST_ROOT}`);
    return [];
  }

  hexo.log.info(`[digest] loading content from ${DIGEST_ROOT}`);

  const files = walkFiles(DIGEST_ROOT);
  const pages = [];
  const items = [];

  for (const filePath of files) {
    const relativePath = path.relative(DIGEST_ROOT, filePath);
    const routePath = toRoutePath(relativePath);

    if (!filePath.endsWith('.md')) {
      pages.push({
        path: routePath,
        data: () => fs.createReadStream(filePath),
      });
      continue;
    }

    const { frontMatter, body } = parseDigestFile(filePath);
    if (frontMatter.draft) continue;

    const stats = fs.statSync(filePath);
    const parsedDate = moment(frontMatter.date || stats.mtime);
    const pageTitle = frontMatter.title || path.basename(filePath, '.md');
    const summary = frontMatter.summary || stripMarkdown(body).slice(0, 180);
    const renderedBody = hexo.render.renderSync({
      path: filePath,
      text: body,
    });

    items.push({
      date: parsedDate,
      routePath: `/${routePath.replace(/index\.html$/, '')}`,
      title: pageTitle,
      summary,
      tags: Array.isArray(frontMatter.tags) ? frontMatter.tags : [],
    });

    const pageData = {
      title: pageTitle,
      path: routePath,
      date: parsedDate,
      updated: parsedDate,
      content: renderedBody,
      excerpt: summary,
      comments: false,
      tags: [],
      categories: [],
    };

    pages.push({
      path: routePath,
      layout: ['post', 'page', 'index'],
      data: {
        page: pageData,
        title: pageTitle,
        path: routePath,
        date: parsedDate,
        content: renderedBody,
      },
    });
  }

  items.sort((left, right) => right.date - left.date);

  const listHtml = [
    '<div class="digest-module">',
    '<p>这里汇总展示 digest 内容仓库中维护的摘要内容。</p>',
    items.length === 0 ? '<p>还没有可展示的 digest。</p>' : '',
    ...items.map((item) => {
      const tagsHtml =
        item.tags.length > 0
          ? `<p><strong>标签：</strong>${item.tags.map(escapeHtml).join(' / ')}</p>`
          : '';

      return [
        '<article class="digest-card">',
        `  <h2><a href="${item.routePath}">${escapeHtml(item.title)}</a></h2>`,
        item.date ? `  <p><strong>日期：</strong>${escapeHtml(formatDateLabel(item.date))}</p>` : '',
        tagsHtml,
        `  <p>${escapeHtml(item.summary)}</p>`,
        `  <p><a href="${item.routePath}">阅读全文</a></p>`,
        '</article>',
      ]
        .filter(Boolean)
        .join('\n');
    }),
    '</div>',
  ]
    .filter(Boolean)
    .join('\n');

  const digestIndexDate = items[0] ? items[0].date : moment();
  const digestIndexPage = {
    title: 'Digest',
    path: 'digest/index.html',
    date: digestIndexDate,
    updated: digestIndexDate,
    content: listHtml,
    comments: false,
    tags: [],
    categories: [],
  };

  pages.push({
    path: 'digest/index.html',
    layout: ['page', 'post', 'index'],
    data: {
      page: digestIndexPage,
      title: 'Digest',
      path: 'digest/index.html',
      date: digestIndexDate,
      content: listHtml,
      digestItems: items,
    },
  });

  return pages;
});
