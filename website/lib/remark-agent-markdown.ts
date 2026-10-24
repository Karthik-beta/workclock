import { replaceSource } from 'fumadocs-core/mdx-plugins/stringifier';
import type { Link, Nodes, Root } from 'mdast';
import type { VFile } from 'vfile';
import { siteUrl } from './shared';

interface JsxElement {
  type: 'mdxJsxFlowElement' | 'mdxJsxTextElement';
  name: string | null;
  attributes: { type: string; name?: string; value?: unknown }[];
  children: Nodes[];
}

export function attribute(el: JsxElement, name: string): string | undefined {
  const value = el.attributes.find((a) => a.name === name)?.value;
  return typeof value === 'string' ? value : undefined;
}

/** `/docs/install/#x` becomes `https://…/workclock/docs/install.md#x`, the page's Markdown version. */
export function markdownUrl(url: string): string {
  const [path, hash] = url.split('#');
  const md = path === '/docs/' || path === '/docs' ? 'docs.md' : `${path.replace(/^\/|\/$/g, '')}.md`;
  return `${siteUrl}${md}${hash ? `#${hash}` : ''}`;
}

/**
 * Shapes the Markdown version of each page (what `getText('processed')` returns) for readers
 * outside the site: components become plain Markdown and site links become absolute.
 * The HTML page is unchanged.
 */
export function remarkAgentMarkdown() {
  return (tree: Root, file: VFile) => {
    visit(tree, (node) => {
      if (node.type === 'link') {
        const link = node as Link;
        if (link.url.startsWith('/')) {
          replaceSource(file, link, (s) => `[${s.inner(link)}](${markdownUrl(link.url)})`);
        }
        return;
      }
      if (node.type !== 'mdxJsxFlowElement' && node.type !== 'mdxJsxTextElement') return;
      const el = node as unknown as JsxElement;
      const self = node as Nodes;
      switch (el.name) {
        case 'Callout': {
          const title = attribute(el, 'title') ?? 'Note';
          replaceSource(file, self, (s) => quote(`**${title}:** ${s.inner(self).trim()}`));
          break;
        }
        case 'Tabs':
          replaceSource(file, self, (s) =>
            el.children
              .map((tab) => {
                const value = attribute(tab as unknown as JsxElement, 'value');
                return value ? `**${value}**\n\n${s.inner(tab).trim()}` : '';
              })
              .filter(Boolean)
              .join('\n\n'),
          );
          break;
        case 'Accordions':
          replaceSource(file, self, (s) => s.inner(self).trim());
          break;
        case 'Accordion':
          replaceSource(
            file,
            self,
            (s) => `\n### ${attribute(el, 'title') ?? ''}\n\n${s.inner(self).trim()}\n`,
          );
          break;
        case 'Cards':
          replaceSource(file, self, (s) => s.inner(self).trim());
          break;
        case 'Card': {
          const href = attribute(el, 'href') ?? '';
          const url = href.startsWith('/') ? markdownUrl(href) : href;
          replaceSource(
            file,
            self,
            (s) => `- [${attribute(el, 'title') ?? ''}](${url}): ${s.inner(self).trim()}`,
          );
          break;
        }
        // The drawing's text equivalent is the scenario the page already states in prose.
        case 'WeekStrip':
          replaceSource(file, self, '');
          break;
      }
    });
  };
}

function quote(text: string): string {
  return text
    .split('\n')
    .map((line) => (line ? `> ${line}` : '>'))
    .join('\n');
}

function visit(node: Nodes, fn: (node: Nodes) => void) {
  fn(node);
  if ('children' in node) for (const child of node.children) visit(child as Nodes, fn);
}
