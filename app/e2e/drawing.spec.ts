import { expect, test, type Page } from '@playwright/test';
import { entityPagePos, rinkToPage, viewportOf } from './helpers';

type Board = { drawings: { tool: string; shape?: string; style: { dash?: string } }[] };
type W = {
  __floorball: {
    store: {
      getState(): {
        board: Board & Record<string, unknown>;
        history: { past: unknown[]; future: unknown[] };
      };
    };
  };
};

const board = (page: Page) =>
  page.evaluate(() => (window as unknown as W).__floorball.store.getState().board);
const historyLen = (page: Page) =>
  page.evaluate(() => {
    const h = (window as unknown as W).__floorball.store.getState().history;
    return { past: h.past.length, future: h.future.length };
  });

async function stroke(page: Page, pts: { x: number; y: number }[]) {
  const screen = await Promise.all(pts.map((p) => rinkToPage(page, p)));
  await page.mouse.move(screen[0]!.x, screen[0]!.y);
  await page.mouse.down();
  for (const s of screen.slice(1)) await page.mouse.move(s.x, s.y, { steps: 6 });
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto('/');
  await expect(page.getByTestId('board-stage').locator('canvas').first()).toBeVisible();
});

test('draw with every tool, undo all, redo all, end at the same state', async ({ page }) => {
  // Some pieces first, including a drag (one undo step).
  await page.getByTestId('add-home-player').click();
  await page.getByTestId('add-away-player').click();
  const id = await page.evaluate(
    () => (window as unknown as W).__floorball.store.getState().board.entities as unknown,
  );
  const first = (id as { id: string }[])[0]!.id;
  const from = await entityPagePos(page, first);
  const to = await rinkToPage(page, { x: -4, y: -4 });
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 15 });
  await page.mouse.up();
  expect((await historyLen(page)).past).toBe(3); // add, add, one drag

  // Pen
  await page.getByTestId('tool-pen').click();
  await page.getByTestId('color-red').click();
  await stroke(page, [
    { x: -15, y: -6 },
    { x: -12, y: -4 },
    { x: -10, y: -6 },
    { x: -8, y: -3 },
  ]);
  // Line
  await page.getByTestId('tool-line').click();
  await page.getByTestId('width-thick').click();
  await stroke(page, [
    { x: -15, y: 6 },
    { x: -8, y: 6 },
  ]);
  // Arrows: run, pass, shot
  await page.getByTestId('tool-arrow').click();
  for (const [kind, y] of [
    ['run', -7],
    ['pass', -5],
    ['shot', -3],
  ] as const) {
    await page.getByTestId(`arrow-${kind}`).click();
    await stroke(page, [
      { x: 2, y },
      { x: 10, y },
    ]);
  }
  // Zones: rectangle and ellipse
  await page.getByTestId('tool-zone').click();
  await page.getByTestId('color-blue').click();
  await page.getByTestId('zone-rect').click();
  await stroke(page, [
    { x: 3, y: 1 },
    { x: 8, y: 5 },
  ]);
  await page.getByTestId('zone-ellipse').click();
  await stroke(page, [
    { x: 11, y: 1 },
    { x: 16, y: 6 },
  ]);
  // Text
  await page.getByTestId('tool-text').click();
  const at = await rinkToPage(page, { x: 0, y: 8 });
  await page.mouse.click(at.x, at.y);
  await page.getByTestId('text-entry').fill('Press high');
  await page.getByTestId('text-entry').press('Enter');

  let b = await board(page);
  expect(b.drawings.map((d) => d.tool)).toEqual([
    'pen',
    'line',
    'arrow',
    'arrow',
    'arrow',
    'zone',
    'zone',
    'text',
  ]);
  expect(b.drawings.slice(2, 5).map((d) => d.style.dash)).toEqual(['solid', 'dashed', 'double']);
  expect(b.drawings.slice(5, 7).map((d) => d.shape)).toEqual(['rect', 'ellipse']);

  // Eraser: one sweep across the line removes it (and only it).
  await page.getByTestId('tool-eraser').click();
  await stroke(page, [
    { x: -11.5, y: 4.5 },
    { x: -11.5, y: 7.5 },
  ]);
  b = await board(page);
  expect(b.drawings.map((d) => d.tool)).toEqual([
    'pen',
    'arrow',
    'arrow',
    'arrow',
    'zone',
    'zone',
    'text',
  ]);

  const end = await board(page);
  const steps = (await historyLen(page)).past;
  expect(steps).toBe(3 + 8 + 1);

  for (let i = 0; i < steps; i++) await page.getByTestId('undo').click();
  await expect(page.getByTestId('undo')).toBeDisabled();
  b = await board(page);
  expect(b.drawings).toEqual([]);
  expect(b.entities).toEqual([]);

  for (let i = 0; i < steps; i++) await page.getByTestId('redo').click();
  await expect(page.getByTestId('redo')).toBeDisabled();
  expect(await board(page)).toEqual(end);
});

test('clear drawings keeps players; Ctrl+Z brings drawings back', async ({ page }) => {
  await page.getByTestId('add-home-player').click();
  await page.getByTestId('tool-arrow').click();
  await stroke(page, [
    { x: 0, y: 0 },
    { x: 6, y: 3 },
  ]);
  const before = await board(page);
  await page.getByTestId('clear-drawings').click();
  const after = await board(page);
  expect(after.drawings).toEqual([]);
  expect(after.frames).toEqual(before.frames);
  expect(after.entities).toEqual(before.entities);
  await page.keyboard.press('Control+z');
  expect((await board(page)).drawings).toHaveLength(1);
});

test('drawing over a player does not move or select it', async ({ page }) => {
  await page.getByTestId('add-home-player').click();
  await page.keyboard.press('Escape');
  const before = await board(page);
  const ent = (before.entities as { id: string }[])[0]!;
  const p = await entityPagePos(page, ent.id);
  await page.getByTestId('tool-line').click();
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 120, p.y + 40, { steps: 8 });
  await page.mouse.up();
  const after = await board(page);
  expect(after.frames).toEqual(before.frames);
  expect(after.drawings).toHaveLength(1);
});

test('once a pen is seen, only the pen draws and a finger pans', async ({ page }) => {
  await page.getByTestId('tool-pen').click();
  const a = await rinkToPage(page, { x: -5, y: 0 });
  const b = await rinkToPage(page, { x: 5, y: 2 });
  // Synthetic pointer events: Playwright's mouse cannot report pointerType pen/touch.
  const send = (pointerType: string, id: number, from: { x: number; y: number }, to: typeof from) =>
    page.evaluate(
      ({ pointerType, id, from, to }) => {
        const el = document.querySelector('[data-testid="board-stage"] canvas')!;
        const fire = (type: string, x: number, y: number) =>
          el.dispatchEvent(
            new PointerEvent(type, {
              pointerType,
              pointerId: id,
              clientX: x,
              clientY: y,
              pressure: 0.6,
              isPrimary: true,
              bubbles: true,
              cancelable: true,
              button: 0,
              buttons: type === 'pointerup' ? 0 : 1,
            }),
          );
        fire('pointerdown', from.x, from.y);
        for (let i = 1; i <= 8; i++)
          fire(
            'pointermove',
            from.x + ((to.x - from.x) * i) / 8,
            from.y + ((to.y - from.y) * i) / 8,
          );
        fire('pointerup', to.x, to.y);
      },
      { pointerType, id, from, to },
    );

  const vp0 = await viewportOf(page);
  await send('pen', 2, a, b);
  let s = await board(page);
  expect(s.drawings).toHaveLength(1);
  expect((s.drawings[0] as { pressures?: number[] }).pressures?.length).toBeGreaterThan(1);

  await send('touch', 7, b, { x: b.x - 80, y: b.y + 30 });
  s = await board(page);
  expect(s.drawings).toHaveLength(1); // the finger drew nothing
  const vp1 = await viewportOf(page);
  expect(vp1.offsetX).toBeCloseTo(vp0.offsetX - 80, 0);
  expect(vp1.offsetY).toBeCloseTo(vp0.offsetY + 30, 0);
});
