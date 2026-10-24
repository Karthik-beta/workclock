import { readdirSync } from 'node:fs';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Every page of the static export, found from its index.html files.
const paths = readdirSync('out', { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name === 'index.html')
  .map((entry) => path.relative('out', entry.parentPath).split(path.sep).join('/'))
  .filter((dir) => !dir.startsWith('_') && dir !== '404')
  .map((dir) => `/workclock/${dir ? `${dir}/` : ''}`)
  .sort();

test('the export has pages to check', () => {
  expect(paths.length).toBeGreaterThan(1);
});

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(colorScheme, () => {
    test.use({ colorScheme });

    for (const pagePath of paths) {
      test(`no WCAG A/AA violations on ${pagePath}`, async ({ page }) => {
        await page.goto(pagePath);
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();
        expect(results.violations).toEqual([]);
      });
    }
  });
}
