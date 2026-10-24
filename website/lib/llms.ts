import type { InferPageType } from 'fumadocs-core/source';
import type { Node } from 'fumadocs-core/page-tree';
import { markdownUrl } from './remark-agent-markdown';
import { repoUrl } from './shared';
import { source } from './source';

type Page = InferPageType<typeof source>;

/** The absolute URL of a page's Markdown version: the page URL without its slash, plus `.md`. */
export function pageMarkdownUrl(page: Page): string {
  return markdownUrl(page.url);
}

/** A page's Markdown version: its title, its URL and the processed Markdown of its body. */
export async function pageMarkdown(page: Page): Promise<string> {
  return `# ${page.data.title}\n\nURL: ${pageMarkdownUrl(page)}\n\n${await page.data.getText('processed')}`;
}

/** Docs pages in sidebar order. */
export function pagesInOrder(): Page[] {
  const byUrl = new Map(source.getPages().map((page) => [page.url, page]));
  const pages: Page[] = [];
  const walk = (nodes: Node[]) => {
    for (const node of nodes) {
      if (node.type === 'page') {
        const page = byUrl.get(node.url);
        if (page) pages.push(page);
      } else if (node.type === 'folder') {
        if (node.index) walk([node.index]);
        walk(node.children);
      }
    }
  };
  walk(source.getPageTree().children);
  return pages;
}

const raw = (path: string) => `${repoUrl.replace('github.com', 'raw.githubusercontent.com')}/main/${path}`;
const optional = new Set(['/docs/benchmarks', '/docs/changelog']);

const header = `# workclock

> Fast, correct business-time arithmetic (working hours, SLAs, shifts) for Rust, Python and JavaScript, and a maintained replacement for businesstimedelta, with a compatibility layer for existing code.

Status: in development. No release has been published yet.

- Install: \`cargo add workclock jiff\` (Rust; the API uses jiff 0.2 types), \`pip install workclock\` or \`uv add workclock\` (Python), \`npm i workclock\` (JavaScript and TypeScript).
- Requires Rust 1.85+, CPython 3.9+, Node.js 22+.
- Inputs must be timezone-aware: Python \`datetime\` with \`tzinfo\`, JavaScript \`Date\` or ISO 8601 string with an offset, Rust \`jiff::Zoned\` or \`jiff::Timestamp\`. Time zones are IANA names such as \`Europe/London\`.
- JavaScript durations are milliseconds.`;

const item = (page: Page) =>
  `- [${page.data.title}](${pageMarkdownUrl(page)}): ${page.data.description ?? ''}`.trimEnd();

/** llms.txt: the facts agents most often get wrong, then every page's Markdown version. */
export function llmsIndex(): string {
  const pages = pagesInOrder();
  return [
    header,
    '## Docs',
    pages.filter((p) => !optional.has(p.url)).map(item).join('\n'),
    '## Reference',
    `- [DESIGN.md](${raw('DESIGN.md')}): the specification, with an example and an ID for every edge case`,
    '## Optional',
    [
      ...pages.filter((p) => optional.has(p.url) && p.url !== '/docs/changelog').map(item),
      `- [Changelog](${raw('CHANGELOG.md')})`,
    ].join('\n'),
  ].join('\n\n') + '\n';
}

/** llms-full.txt: every docs page's Markdown in sidebar order. */
export async function llmsFull(): Promise<string> {
  const pages = await Promise.all(pagesInOrder().map(pageMarkdown));
  return `${pages.join('\n\n')}\n`;
}
