import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { siteUrl } from '../lib/shared';

// Every exported page's og:image must name a file in the export.
const pages = readdirSync('out', { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name === 'index.html')
  .map((entry) => path.join(entry.parentPath, entry.name))
  .filter((file) => !path.relative('out', file).startsWith('_'));

for (const file of pages) {
  test(`share image of ${path.relative('out', file)} exists`, () => {
    const html = readFileSync(file, 'utf8');
    const image = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
    expect(image).toBeDefined();
    const url = new URL(image ?? '');
    expect(url.href.startsWith(siteUrl)).toBe(true);
    expect(existsSync(path.join('out', url.pathname.slice(new URL(siteUrl).pathname.length)))).toBe(true);
  });
}
