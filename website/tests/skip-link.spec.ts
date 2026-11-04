import { expect, test } from '@playwright/test';

for (const pagePath of ['/', '/playground/', '/docs/', '/no-such-page/']) {
  test(`the skip link is the first stop on ${pagePath}`, async ({ page }) => {
    await page.goto(pagePath);
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toHaveText('Skip to content');
  });
}
