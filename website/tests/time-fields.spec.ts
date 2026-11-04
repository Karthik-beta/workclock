import { expect, test } from '@playwright/test';

const timeError = 'Write times as HH:MM on a 24-hour clock, such as 09:30.';

for (const { path, field } of [
  { path: '/', field: 'Start' },
  { path: '/playground/', field: 'Working hours start' },
]) {
  test.describe(path, () => {
    test('the time error stays while an invalid time is shown', async ({ page }) => {
      await page.goto(path);
      const start = page.getByRole('textbox', { name: field, exact: true });
      await start.fill('9');
      await start.press('Enter');
      await expect(page.getByText(timeError)).toBeVisible();

      await page.getByRole('button', { name: 'One hour more' }).click();
      await expect(start).toHaveValue('9');
      await expect(page.getByText(timeError)).toBeVisible();
    });

    test('the time error clears when the stored time is typed back', async ({ page }) => {
      await page.goto(path);
      const start = page.getByRole('textbox', { name: field, exact: true });
      const stored = await start.inputValue();
      await start.fill('9');
      await start.press('Enter');
      await expect(page.getByText(timeError)).toBeVisible();

      await start.fill(stored);
      await start.press('Enter');
      await expect(start).not.toHaveAttribute('aria-invalid');
      await expect(page.getByText(timeError)).toBeHidden();
    });
  });
}

test('the time error clears when the invalid field is removed', async ({ page }) => {
  await page.goto('/playground/');
  const breakStart = page.getByRole('textbox', { name: 'Break start', exact: true });
  await breakStart.fill('9');
  await breakStart.press('Enter');
  await expect(page.getByText(timeError)).toBeVisible();

  await page.getByRole('checkbox', { name: 'Break' }).uncheck();
  await expect(page.getByText(timeError)).toBeHidden();
});
