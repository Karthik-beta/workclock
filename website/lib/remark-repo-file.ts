import { replaceSource } from 'fumadocs-core/mdx-plugins/stringifier';
import type { Nodes, Root, RootContent } from 'mdast';
import type { VFile } from 'vfile';
import { repoUrl } from './shared';

interface JsxElement {
  type: 'mdxJsxFlowElement';
  name: string | null;
  attributes: { type: string; name?: string; value?: unknown }[];
  children: RootContent[];
}

/**
 * Unwraps `<RepoFile path="benchmarks/RESULTS.md">…</RepoFile>` after `<include>` has filled it:
 * drops the file's own H1 (the page has its title) and points relative links at GitHub, in the
 * page and in its Markdown version.
 */
export function remarkRepoFile() {
  return (tree: Root, file: VFile) => {
    tree.children = tree.children.flatMap((node) => {
      const el = node as unknown as JsxElement;
      if (el.type !== 'mdxJsxFlowElement' || el.name !== 'RepoFile') return [node];
      const path = el.attributes.find((a) => a.name === 'path')?.value;
      if (typeof path !== 'string') throw new Error('<RepoFile> needs a path attribute');
      const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
      // `<include>` leaves the file as a nested root node.
      const children = el.children
        .flatMap((c) => ((c as unknown as Root).type === 'root' ? (c as unknown as Root).children : [c]))
        .filter((c) => !(c.type === 'heading' && c.depth === 1));
      for (const child of children) rewriteLinks(child, dir, file);
      replaceSource(file, node as Nodes, (s) => children.map((c) => s.stringify(c)).join('\n\n'));
      return children;
    });
  };
}

function rewriteLinks(node: Nodes, dir: string, file: VFile) {
  if (node.type === 'link' && !/^([a-z]+:|#|\/)/.test(node.url)) {
    const link = node;
    link.url = new URL(dir + link.url, `${repoUrl}/blob/main/`).href;
    replaceSource(file, link, (s) => `[${s.inner(link)}](${link.url})`);
  }
  if ('children' in node) for (const child of node.children) rewriteLinks(child as Nodes, dir, file);
}
