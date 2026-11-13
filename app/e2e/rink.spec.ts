import { expect, test, type Page } from '@playwright/test';
import { rinkToPage, snapshot, stageBox, viewportOf } from './helpers';

async function rinkOnScreen(page: Page, lengthM: number, widthM: number) {
  const a = await rinkToPage(page, { x: -lengthM / 2, y: -widthM / 2 });
  const b = await rinkToPage(page, { x: lengthM / 2, y: widthM / 2 });
  return {
    left: Math.min(a.x, b.x),
    top: Math.min(a.y, b.y),
    right: Math.max(a.x, b.x),
    bottom: Math.max(a.y, b.y),
  };
}

const sizes = [
  { name: 'landscape tablet', width: 1024, height: 768, rotation: 0 },
  { name: 'portrait tablet', width: 768, height: 1024, rotation: 90 },
  { name: 'phone', width: 390, height: 844, rotation: 90 },
];

for (const s of sizes) {
  test(`rink fits undistorted at ${s.width}x${s.height} (${s.name})`, async ({ page }) => {
    await page.setViewportSize({ width: s.width, height: s.height });
    await page.goto('/');
    await expect(page.getByTestId('board-stage').locator('canvas').first()).toBeVisible();
    const vp = await viewportOf(page);
    const box = await stageBox(page);
    // Orientation is whichever shows the rink (plus margin, 43 x 23 m) largest.
    const pad = 16;
    const s0 = Math.min((box.width - pad) / 43, (box.height - pad) / 23);
    const s90 = Math.min((box.width - pad) / 23, (box.height - pad) / 43);
    // (fitViewport keeps landscape unless rotating gains more than 5%)
    expect(vp.scale).toBeCloseTo(vp.rotation === 90 ? s90 : s0, 6);
    if (vp.rotation === 0) expect(s90).toBeLessThanOrEqual(s0 * 1.05);
    else expect(s90).toBeGreaterThan(s0 * 1.05);
    expect(vp.rotation).toBe(s.rotation);
    const r = await rinkOnScreen(page, 40, 20);
    // Inside the stage
    expect(r.left).toBeGreaterThanOrEqual(box.x - 0.5);
    expect(r.top).toBeGreaterThanOrEqual(box.y - 0.5);
    expect(r.right).toBeLessThanOrEqual(box.x + box.width + 0.5);
    expect(r.bottom).toBeLessThanOrEqual(box.y + box.height + 0.5);
    // Undistorted: on-screen aspect is exactly 2:1 along the rink's length
    const w = r.right - r.left;
    const h = r.bottom - r.top;
    expect(Math.max(w, h) / Math.min(w, h)).toBeCloseTo(2, 5);
    // Uses most of the available space
    const fill = vp.rotation === 0 ? w / box.width : h / box.height;
    expect(fill).toBeGreaterThan(0.75);
  });
}

test('half-rink views show the correct half', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/');
  const box = await stageBox(page);
  const inside = (p: { x: number; y: number }) =>
    p.x >= box.x && p.x <= box.x + box.width && p.y >= box.y && p.y <= box.y + box.height;

  await page.getByTestId('rink-view').selectOption('half-left');
  expect(inside(await rinkToPage(page, { x: -16.5, y: 0 }))).toBe(true);
  expect(inside(await rinkToPage(page, { x: 16.5, y: 0 }))).toBe(false);

  await page.getByTestId('rink-view').selectOption('half-right');
  expect(inside(await rinkToPage(page, { x: 16.5, y: 0 }))).toBe(true);
  expect(inside(await rinkToPage(page, { x: -16.5, y: 0 }))).toBe(false);
});

test('rink size presets and custom size', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('rink-preset').selectOption('minimum');
  expect((await snapshot(page)).rink).toMatchObject({ lengthM: 36, widthM: 18 });
  await page.getByTestId('rink-preset').selectOption('custom');
  await page.getByTestId('custom-length').fill('24');
  await page.getByTestId('custom-width').fill('14');
  await page.getByTestId('custom-apply').click();
  expect((await snapshot(page)).rink).toMatchObject({ lengthM: 24, widthM: 14 });
  const box = await stageBox(page);
  const r = await rinkOnScreen(page, 24, 14);
  expect((r.right - r.left) / (r.bottom - r.top)).toBeCloseTo(24 / 14, 5);
  expect(r.right).toBeLessThanOrEqual(box.x + box.width + 0.5);
});

test('wheel zooms about the cursor and Fit restores the view', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/');
  const before = await viewportOf(page);
  const box = await stageBox(page);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -400);
  await expect.poll(async () => (await viewportOf(page)).scale).toBeGreaterThan(before.scale);
  await page.getByTestId('fit').click();
  await expect.poll(async () => (await viewportOf(page)).scale).toBeCloseTo(before.scale, 6);
});
