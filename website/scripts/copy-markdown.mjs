// Copies each page's Markdown from out/llms.mdx/docs/<slug>/content.md to out/docs/<slug>.md,
// the page URL without its trailing slash plus ".md". A static export has no rewrites.
import { cpSync, readdirSync } from 'node:fs';
import path from 'node:path';

const from = path.join('out', 'llms.mdx', 'docs');
let copied = 0;
for (const entry of readdirSync(from, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || entry.name !== 'content.md') continue;
  const slug = path.relative(from, entry.parentPath);
  const target = slug ? path.join('out', 'docs', `${slug}.md`) : path.join('out', 'docs.md');
  cpSync(path.join(entry.parentPath, entry.name), target);
  copied++;
}
console.log(`copy-markdown: ${copied} pages`);
