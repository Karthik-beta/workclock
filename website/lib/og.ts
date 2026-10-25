import type { Node } from 'fumadocs-core/page-tree';
import type { InferPageType } from 'fumadocs-core/source';
import { siteUrl } from './shared';
import { source } from './source';

type Page = InferPageType<typeof source>;

/** The social card's URL: `/og/docs/<slug>/image.png`, written at build time. */
export function pageImageUrl(page: Page): string {
  return new URL(['og/docs', ...page.slugs, 'image.png'].join('/'), siteUrl).href;
}

/** The sidebar section a page sits under, such as "Concepts"; "Docs" before the first separator. */
export function pageSection(page: Page): string {
  let section = 'Docs';
  let found: string | undefined;
  const walk = (nodes: Node[]) => {
    for (const node of nodes) {
      if (found) return;
      if (node.type === 'separator' && typeof node.name === 'string') section = node.name;
      else if (node.type === 'page' && node.url === page.url) found = section;
      else if (node.type === 'folder') {
        if (node.index) walk([node.index]);
        walk(node.children);
      }
    }
  };
  walk(source.getPageTree().children);
  return found ?? 'Docs';
}
