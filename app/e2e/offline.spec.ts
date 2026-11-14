import { expect, test } from '@playwright/test';

// PLAN.md M6: the app loads and works with no network after the first visit.
// Runs against the production build (`npm run preview`), where the service worker exists.

test('after one visit the app opens, edits and saves with the network off', async ({
  page,
  context,
}) => {
  // First visit online: wait until the service worker has installed and controls the page.
  await page.goto('/?debug');
  await expect(page.getByTestId('library')).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);

  await context.setOffline(true);
  // Prove the network really is gone.
  const online = await page.evaluate(() =>
    fetch('https://example.com', { mode: 'no-cors' }).then(
      () => true,
      () => false,
    ),
  );
  expect(online).toBe(false);

  await page.reload();
  await expect(page.getByTestId('library')).toBeVisible();

  // Make a board offline.
  await page.getByTestId('new-board').click();
  await page.getByTestId('board-stage').locator('canvas').first().waitFor();
  for (let i = 0; i < 3; i++) await page.getByTestId('add-home-player').click();
  await page.getByTestId('add-away-goalie').click();
  await page.getByTestId('add-step').click();
  await page.getByTestId('board-name').fill('Offline drill');
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved');
  type W = { __floorball: { store: { getState(): { board: unknown } } } };
  const before = await page.evaluate(
    () => (window as unknown as W).__floorball.store.getState().board,
  );

  // Still offline: reload, it comes back from the cache and the board from IndexedDB.
  await page.reload();
  await page.getByTestId('board-stage').locator('canvas').first().waitFor();
  expect(
    await page.evaluate(() => (window as unknown as W).__floorball.store.getState().board),
  ).toEqual(before);

  // And the drill still plays.
  await page.getByTestId('play').click();
  await expect(page.getByTestId('play')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('play')).toHaveAttribute('aria-pressed', 'false', {
    timeout: 5000,
  });

  // The installable-app manifest is served (from cache) too.
  const manifest = await page.evaluate(() =>
    fetch('./manifest.webmanifest').then((r) => r.json() as Promise<{ display: string }>),
  );
  expect(manifest.display).toBe('standalone');
});
