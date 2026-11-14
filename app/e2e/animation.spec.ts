import { expect, test, type Page } from '@playwright/test';
import { rinkToPage } from './helpers';

type Vec = { x: number; y: number };
type W = {
  __floorball: {
    store: {
      getState(): {
        board: {
          entities: { id: string }[];
          frames: { id: string; durationMs: number; positions: Record<string, Vec> }[];
          drawings: { frameId?: string }[];
        };
        frameIndex: number;
      };
    };
    playback: { getState(): { playing: boolean; playheadMs: number; pausedAt: number | null } };
    stage(): {
      findOne(sel: string): { position(): Vec } | undefined;
      find(sel: string): unknown[];
    } | null;
    debugState: { viewport: unknown };
    viewport: { screenToRink(p: Vec, vp: unknown): Vec };
  };
};

const pb = (page: Page) =>
  page.evaluate(() => (window as unknown as W).__floorball.playback.getState());
const st = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as W).__floorball.store.getState();
    return { board: s.board, frameIndex: s.frameIndex };
  });

/** Where the piece is drawn on the stage, in rink metres. */
const drawnAt = (page: Page, id: string) =>
  page.evaluate((id) => {
    const f = (window as unknown as W).__floorball;
    const node = f.stage()!.findOne(`#${id}`)!;
    return f.viewport.screenToRink(node.position(), f.debugState.viewport);
  }, id);

async function drag(page: Page, id: string, to: Vec) {
  const { board, frameIndex } = await st(page);
  const from = await rinkToPage(page, board.frames[frameIndex]!.positions[id]!);
  const dest = await rinkToPage(page, to);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(dest.x, dest.y, { steps: 10 });
  await page.mouse.up();
}

/** Same easing and timing as KeyframeTrackSource, for checking what is drawn. */
function expected(
  frames: { durationMs: number; positions: Record<string, Vec> }[],
  id: string,
  t: number,
) {
  let start = 0;
  for (let i = 0; i < frames.length - 1; i++) {
    const d = frames[i]!.durationMs;
    if (t <= start + d) {
      const k = (t - start) / d;
      const e = k * k * (3 - 2 * k);
      const a = frames[i]!.positions[id]!;
      const b = frames[i + 1]!.positions[id]!;
      return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e };
    }
    start += d;
  }
  return frames[frames.length - 1]!.positions[id]!;
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/#/new');
  await page.getByTestId('board-stage').locator('canvas').first().waitFor();
});

test('a three-step drill plays, pauses at an arbitrary time and resumes from there', async ({
  page,
}) => {
  await page.getByTestId('add-home-player').click();
  const id = (await st(page)).board.entities[0]!.id;
  await drag(page, id, { x: -10, y: 0 });

  await page.getByTestId('add-step').click();
  await drag(page, id, { x: 0, y: 5 });
  await page.getByTestId('add-step').click();
  await drag(page, id, { x: 10, y: -5 });
  await expect(page.getByTestId('step-3')).toHaveAttribute('aria-pressed', 'true');

  const { board } = await st(page);
  expect(board.frames).toHaveLength(3);
  const pos = board.frames.map((f) => f.positions[id]!);
  expect(pos[0]!.x).toBeCloseTo(-10, 0);
  expect(pos[1]!.y).toBeCloseTo(5, 0);
  expect(pos[2]!.x).toBeCloseTo(10, 0);

  // Make it slow enough to pause mid-way reliably: 2 s per move.
  await page.getByTestId('step-1').click();
  await page.getByTestId('step-duration').selectOption('2000');
  await page.getByTestId('step-2').click();
  await page.getByTestId('step-duration').selectOption('2000');
  await page.getByTestId('step-1').click();

  await page.getByTestId('play').click();
  expect((await pb(page)).playing).toBe(true);
  // Nothing can be edited while it plays.
  await expect(page.getByTestId('add-home-player')).toBeDisabled();
  await expect(page.getByTestId('tool-pen')).toBeDisabled();

  await page.waitForTimeout(1300);
  await page.getByTestId('play').click(); // pause
  const paused = await pb(page);
  expect(paused.playing).toBe(false);
  const t = paused.pausedAt!;
  expect(t).toBeGreaterThan(500);
  expect(t).toBeLessThan(3500);
  expect(t % 2000).not.toBe(0); // between steps
  await expect(page.getByTestId('add-home-player')).toBeEnabled();

  // The board shows the drill at exactly that time (through the track source).
  const shown = await drawnAt(page, id);
  const want = expected((await st(page)).board.frames, id, t);
  expect(shown.x).toBeCloseTo(want.x, 1);
  expect(shown.y).toBeCloseTo(want.y, 1);
  // Editing targets the nearest step.
  expect((await st(page)).frameIndex).toBe(Math.round(t / 2000));

  // Resume: it carries on from t, not from a step.
  await page.getByTestId('play').click();
  const resumed = await pb(page);
  expect(resumed.playing).toBe(true);
  expect(resumed.playheadMs).toBeGreaterThanOrEqual(t);
  expect(resumed.playheadMs).toBeLessThan(t + 400);

  // ... and stops on the last step.
  await expect.poll(async () => (await pb(page)).playing, { timeout: 8000 }).toBe(false);
  expect((await pb(page)).pausedAt).toBeNull();
  expect((await st(page)).frameIndex).toBe(2);
  const end = await drawnAt(page, id);
  expect(end.x).toBeCloseTo(pos[2]!.x, 1);
  expect(end.y).toBeCloseTo(pos[2]!.y, 1);
});

test('a drawing pinned to a step shows only on that step', async ({ page }) => {
  await page.getByTestId('add-home-player').click();
  await page.getByTestId('add-step').click();
  await page.getByTestId('tool-arrow').click();
  await page.getByTestId('pin-to-step').click();
  const a = await rinkToPage(page, { x: -5, y: -5 });
  const b = await rinkToPage(page, { x: 5, y: -5 });
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await page.mouse.up();

  const { board } = await st(page);
  expect(board.drawings[0]!.frameId).toBe(board.frames[1]!.id);
  const drawn = () =>
    page.evaluate(() => (window as unknown as W).__floorball.stage()!.find('.drawing').length);
  expect(await drawn()).toBe(1);
  await page.getByTestId('step-1').click();
  await expect.poll(drawn).toBe(0);
  await page.getByTestId('step-2').click();
  await expect.poll(drawn).toBe(1);
});

test('trails show where pieces go next', async ({ page }) => {
  await page.getByTestId('add-home-player').click();
  const id = (await st(page)).board.entities[0]!.id;
  await page.getByTestId('add-step').click();
  await drag(page, id, { x: 8, y: 6 });
  await page.getByTestId('step-1').click();
  const trails = () =>
    page.evaluate(() => (window as unknown as W).__floorball.stage()!.find('.trail').length);
  await expect.poll(trails).toBe(1);
  await page.getByTestId('trails').click();
  await expect.poll(trails).toBe(0);
});
