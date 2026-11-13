import { expect, test } from '@playwright/test';
import { entityPagePos, rinkToPage, snapshot } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await expect(page.getByTestId('board-stage').locator('canvas').first()).toBeVisible();
});

test('five-a-side plus goalies: add, move, relabel, delete', async ({ page }) => {
  for (let i = 0; i < 5; i++) await page.getByTestId('add-home-player').click();
  await page.getByTestId('add-home-goalie').click();
  for (let i = 0; i < 5; i++) await page.getByTestId('add-away-player').click();
  await page.getByTestId('add-away-goalie').click();

  let snap = await snapshot(page);
  expect(snap.entities).toHaveLength(12);
  const count = (kind: string, team: string) =>
    snap.entities.filter((e) => e.kind === kind && e.team === team).length;
  expect(count('player', 'home')).toBe(5);
  expect(count('player', 'away')).toBe(5);
  expect(count('goalie', 'home')).toBe(1);
  expect(count('goalie', 'away')).toBe(1);

  // Move: drag home player 3 to a known rink point
  const p3 = snap.entities.find(
    (e) => e.kind === 'player' && e.team === 'home' && e.label === '3',
  )!;
  const from = await entityPagePos(page, p3.id);
  const target = { x: -2, y: 6 };
  const to = await rinkToPage(page, target);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
  snap = await snapshot(page);
  expect(snap.positions[p3.id]!.x).toBeCloseTo(target.x, 0);
  expect(snap.positions[p3.id]!.y).toBeCloseTo(target.y, 0);
  expect(snap.selection).toEqual([p3.id]);

  // Relabel: tap away player 2, type a name
  const a2 = snap.entities.find(
    (e) => e.kind === 'player' && e.team === 'away' && e.label === '2',
  )!;
  const a2pos = await entityPagePos(page, a2.id);
  await page.mouse.click(a2pos.x, a2pos.y);
  await expect.poll(async () => (await snapshot(page)).selection).toEqual([a2.id]);
  await page.getByTestId('label-input').fill('Kim');

  // Delete: tap home player 5, press Delete
  const h5 = snap.entities.find(
    (e) => e.kind === 'player' && e.team === 'home' && e.label === '5',
  )!;
  const h5pos = await entityPagePos(page, h5.id);
  await page.mouse.click(h5pos.x, h5pos.y);
  await expect.poll(async () => (await snapshot(page)).selection).toEqual([h5.id]);
  await page.getByTestId('delete').click();

  snap = await snapshot(page);
  expect(snap.entities).toHaveLength(11);
  expect(snap.entities.find((e) => e.id === h5.id)).toBeUndefined();
  expect(snap.positions[h5.id]).toBeUndefined();
  expect(snap.entities.find((e) => e.id === a2.id)!.label).toBe('Kim');
  expect(snap.positions[p3.id]!.x).toBeCloseTo(target.x, 0);
  // Every remaining entity still has a position on the rink (incl. off-rink margin)
  for (const e of snap.entities) {
    const p = snap.positions[e.id]!;
    expect(Math.abs(p.x)).toBeLessThanOrEqual(21.5);
    expect(Math.abs(p.y)).toBeLessThanOrEqual(11.5);
  }
});

test('drag-box multi-select, then duplicate, recolour and delete', async ({ page }) => {
  for (let i = 0; i < 3; i++) await page.getByTestId('add-home-player').click();
  await page.getByTestId('add-cone').click();
  let snap = await snapshot(page);
  const homeIds = snap.entities.filter((e) => e.kind === 'player').map((e) => e.id);
  const pts = await Promise.all(homeIds.map((id) => entityPagePos(page, id)));
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  // Start the box on empty rink well outside any token
  const start = { x: Math.min(...xs) - 40, y: Math.min(...ys) - 40 };
  const end = { x: Math.max(...xs) + 30, y: Math.max(...ys) + 30 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();
  snap = await snapshot(page);
  expect([...snap.selection].sort()).toEqual([...homeIds].sort());

  await page.getByTestId('team-select').selectOption('away');
  snap = await snapshot(page);
  for (const id of homeIds) expect(snap.entities.find((e) => e.id === id)!.team).toBe('away');

  await page.getByTestId('duplicate').click();
  snap = await snapshot(page);
  expect(snap.entities).toHaveLength(7);
  expect(snap.selection).toHaveLength(3);

  await page.keyboard.press('Delete');
  snap = await snapshot(page);
  expect(snap.entities).toHaveLength(4);
});

test('tokens have a 44 pt touch target even when drawn small', async ({ page }) => {
  await page.getByTestId('add-ball').click();
  const snap = await snapshot(page);
  const ball = snap.entities.find((e) => e.kind === 'ball')!;
  // Clear selection, then tap 19 px off the ball's centre (the ball itself is ~5-10 px).
  await page.keyboard.press('Escape');
  const c = await entityPagePos(page, ball.id);
  await page.mouse.click(c.x + 19, c.y);
  await expect.poll(async () => (await snapshot(page)).selection).toEqual([ball.id]);
});

test('dragging is clamped just outside the boards', async ({ page }) => {
  await page.getByTestId('add-home-player').click();
  const id = (await snapshot(page)).entities[0]!.id;
  const from = await entityPagePos(page, id);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(2, from.y, { steps: 10 });
  await page.mouse.up();
  const p = (await snapshot(page)).positions[id]!;
  expect(p.x).toBeCloseTo(-21.5, 1);
});
