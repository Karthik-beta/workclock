import type { Root, RootContent } from 'mdast';
import { repoUrl } from './shared';

interface JsxElement {
  type: 'mdxJsxFlowElement';
  name: string | null;
  attributes: { type: string; name?: string; value?: unknown }[];
  children: RootContent[];
}

/**
 * Unwraps `<RepoFile path="benchmarks/RESULTS.md">…</RepoFile>` after `<include>` has filled it:
 * drops the file's own H1 (the page has its title) and points relative links at GitHub.
 */
export function remarkRepoFile() {
  return (tree: Root) => {
    tree.children = tree.children.flatMap((node) => {
      const el = node as unknown as JsxElement;
      if (el.type !== 'mdxJsxFlowElement' || el.name !== 'RepoFile') return [node];
      const file = el.attributes.find((a) => a.name === 'path')?.value;
      if (typeof file !== 'string') throw new Error('<RepoFile> needs a path attribute');
      const dir = file.includes('/') ? file.slice(0, file.lastIndexOf('/') + 1) : '';
      // `<include>` leaves the file as a nested root node.
      const children = el.children
        .flatMap((c) => ((c as unknown as Root).type === 'root' ? (c as unknown as Root).children : [c]))
        .filter((c) => !(c.type === 'heading' && c.depth === 1));
      for (const child of children) rewriteLinks(child, dir);
      return children;
    });
  };
}

function rewriteLinks(node: RootContent, dir: string) {
  if (node.type === 'link' && !/^([a-z]+:|#|\/)/.test(node.url)) {
    node.url = new URL(dir + node.url, `${repoUrl}/blob/main/`).href;
  }
  if ('children' in node) for (const child of node.children) rewriteLinks(child as RootContent, dir);
}
