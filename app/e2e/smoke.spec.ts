import { expect, test } from '@playwright/test';

test('app loads and draws the board', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page).toHaveTitle('Floorball Board');
  await expect(page.getByTestId('board-stage').locator('canvas').first()).toBeVisible();
  expect(errors).toEqual([]);
});
