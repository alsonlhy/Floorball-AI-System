import { readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { rinkToPage, menuItem } from './helpers';

type W = {
  __floorball: {
    store: { getState(): { board: Record<string, unknown> & { id: string; name: string } } };
  };
};
const board = (page: Page) =>
  page.evaluate(() => (window as unknown as W).__floorball.store.getState().board);

async function newBoard(page: Page) {
  await page.goto('/#/new');
  await page.getByTestId('board-stage').locator('canvas').first().waitFor();
}

async function waitSaved(page: Page) {
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved');
}

async function drawArrow(page: Page) {
  await page.getByTestId('tool-arrow').click();
  const a = await rinkToPage(page, { x: -6, y: -3 });
  const b = await rinkToPage(page, { x: 4, y: 2 });
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
  await page.getByTestId('tool-select').click();
}

/** A board with pieces, a drawing and a name. */
async function buildBoard(page: Page, name: string) {
  await newBoard(page);
  for (let i = 0; i < 3; i++) await page.getByTestId('add-home-player').click();
  await page.getByTestId('add-away-goalie').click();
  await page.getByTestId('add-ball').click();
  await drawArrow(page);
  await page.getByTestId('board-name').fill(name);
  await waitSaved(page);
  return board(page);
}

test('a board survives a page reload', async ({ page }) => {
  const before = await buildBoard(page, 'Breakout 2-1-2');
  expect(page.url()).toContain(`#/b/${before.id}`);
  await page.reload();
  await page.getByTestId('board-stage').locator('canvas').first().waitFor();
  expect(await board(page)).toEqual(before);
  await expect(page.getByTestId('board-name')).toHaveValue('Breakout 2-1-2');
});

test('library: list, thumbnail, rename, duplicate, delete with confirmation', async ({ page }) => {
  const first = await buildBoard(page, 'Penalty kill box');
  await page.getByTestId('back-to-library').click();
  await expect(page.getByTestId('board-card')).toHaveCount(1);
  await expect(page.getByTestId('board-thumb')).toBeVisible();

  // A second, newer board is listed first.
  await page.getByTestId('new-board').click();
  await page.getByTestId('board-stage').locator('canvas').first().waitFor();
  await page.getByTestId('add-cone').click();
  await waitSaved(page);
  await page.getByTestId('back-to-library').click();
  const names = page.getByTestId('board-name-label');
  await expect(names).toHaveText(['Untitled board', 'Penalty kill box']);

  // Rename the older one; it becomes the most recently edited.
  const card = page.locator(`[data-board-id="${first.id}"]`);
  await card.getByTestId('rename-board').click();
  await page.getByTestId('dialog-input').fill('PK box');
  await page.getByTestId('dialog-confirm').click();
  await expect(names).toHaveText(['PK box', 'Untitled board']);

  // Duplicate.
  await page.locator(`[data-board-id="${first.id}"]`).getByTestId('duplicate-board').click();
  await expect(names).toHaveText(['PK box (copy)', 'PK box', 'Untitled board']);

  // Delete asks first; Cancel keeps it.
  const untitled = page.getByTestId('board-card').filter({ hasText: 'Untitled board' });
  await untitled.getByTestId('delete-board').click();
  await expect(page.getByTestId('dialog')).toContainText('cannot be undone');
  await page.getByTestId('dialog-cancel').click();
  await expect(page.getByTestId('board-card')).toHaveCount(3);
  await untitled.getByTestId('delete-board').click();
  await page.getByTestId('dialog-confirm').click();
  await expect(names).toHaveText(['PK box (copy)', 'PK box']);

  // Opening a card opens that board with its content.
  await page.locator(`[data-board-id="${first.id}"]`).getByTestId('open-board').click();
  await page.getByTestId('board-stage').locator('canvas').first().waitFor();
  const opened = await board(page);
  expect(opened.id).toBe(first.id);
  expect(opened.name).toBe('PK box');
  expect(opened.entities).toEqual(first.entities);
  expect(opened.drawings).toEqual(first.drawings);
});

test('export then import gives an identical board', async ({ page }, info) => {
  const original = await buildBoard(page, 'Free-hit routine');
  const download = page.waitForEvent('download');
  await (await menuItem(page, 'export-json')).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('Free-hit routine.json');
  const path = info.outputPath('export.json');
  await file.saveAs(path);
  expect(JSON.parse(await readFile(path, 'utf8'))).toEqual(original);

  // Remove the original, then import the file: exactly the same board comes back.
  await page.getByTestId('back-to-library').click();
  await page.getByTestId('delete-board').click();
  await page.getByTestId('dialog-confirm').click();
  await expect(page.getByTestId('board-card')).toHaveCount(0);

  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('import-board').click();
  await (await chooser).setFiles(path);
  await expect(page.getByTestId('library-message')).toContainText('Imported "Free-hit routine"');
  await page.getByTestId('open-board').click();
  await page.getByTestId('board-stage').locator('canvas').first().waitFor();
  expect(await board(page)).toEqual(original);
});

test('a corrupt or wrong file is rejected with a readable message', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.getByTestId('library')).toBeVisible();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  const garbage = info.outputPath('garbage.json');
  await writeFile(garbage, '{"schemaVersion": 1, "entities": [');
  let chooser = page.waitForEvent('filechooser');
  await page.getByTestId('import-board').click();
  await (await chooser).setFiles(garbage);
  await expect(page.getByRole('alert')).toContainText('not valid JSON');

  const wrong = info.outputPath('wrong.json');
  const valid = await (async () => {
    await page.goto('/#/new');
    await page.getByTestId('board-stage').locator('canvas').first().waitFor();
    await page.getByTestId('add-home-player').click();
    await waitSaved(page);
    return board(page);
  })();
  const broken = {
    ...valid,
    entities: (valid.entities as Record<string, unknown>[]).map((e) => ({
      ...e,
      kind: 'goalkeeper',
    })),
  };
  await writeFile(wrong, JSON.stringify(broken));
  await page.getByTestId('back-to-library').click();
  chooser = page.waitForEvent('filechooser');
  await page.getByTestId('import-board').click();
  await (await chooser).setFiles(wrong);
  await expect(page.getByRole('alert')).toContainText('entities[0].kind is "goalkeeper"');

  // Nothing was added and the app still works.
  await expect(page.getByTestId('board-card')).toHaveCount(1);
  await page.getByTestId('new-board').click();
  await page.getByTestId('board-stage').locator('canvas').first().waitFor();
  expect(errors).toEqual([]);
});

test('export the current view as PNG', async ({ page }, info) => {
  await buildBoard(page, 'Picture');
  const download = page.waitForEvent('download');
  await (await menuItem(page, 'export-png')).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('Picture.png');
  const path = info.outputPath('view.png');
  await file.saveAs(path);
  const bytes = await readFile(path);
  expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  expect(bytes.length).toBeGreaterThan(5000);
});

test('the sample drill opens on a fresh device', async ({ page }) => {
  await page.goto('/#/sample');
  await page.getByTestId('board-stage').locator('canvas').first().waitFor();
  const b = await board(page);
  expect(b.name).toBe('Sample: switch and shoot');
  expect((b.frames as unknown[]).length).toBe(3);
  expect(page.url()).toContain(`#/b/${b.id}`);
  await page.getByTestId('back-to-library').click();
  await expect(page.getByTestId('board-name-label')).toHaveText(['Sample: switch and shoot']);
});
