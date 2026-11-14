import { expect, test } from '@playwright/test';

// PLAN.md M6 layout and touch rules that can be checked without a real iPad.

async function open(page: import('@playwright/test').Page) {
  await page.goto('/#/new');
  await page.getByTestId('board-stage').locator('canvas').first().waitFor();
}

test('landscape tablet: tools at the left edge, pieces at the right edge', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await open(page);
  const tools = (await page.getByTestId('tool-pen').boundingBox())!;
  const pieces = (await page.getByTestId('add-home-player').boundingBox())!;
  const stage = (await page.getByTestId('board-stage').boundingBox())!;
  expect(tools.x).toBeLessThan(80);
  expect(pieces.x + pieces.width).toBeGreaterThan(1024 - 80);
  // The board gets most of the screen.
  expect((stage.width * stage.height) / (1024 * 768)).toBeGreaterThan(0.7);
});

test('portrait tablet: controls in rows below the board', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await open(page);
  const stage = (await page.getByTestId('board-stage').boundingBox())!;
  const tools = (await page.getByTestId('tool-pen').boundingBox())!;
  const pieces = (await page.getByTestId('add-home-player').boundingBox())!;
  expect(tools.y).toBeGreaterThanOrEqual(stage.y + stage.height - 1);
  expect(pieces.y).toBeGreaterThan(tools.y);
  expect(stage.height / 1024).toBeGreaterThan(0.6);
});

test('every control is at least a 44 pt touch target', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await open(page);
  await page.getByTestId('tool-arrow').click(); // shows the style strip too
  await page.getByTestId('add-home-player').click(); // and the selection panel
  const small = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('button, select, input')]
      .filter((el) => el.offsetParent !== null)
      .map((el) => ({ id: el.dataset.testid ?? el.textContent, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width < 43.5 || r.height < 43.5)
      .map(({ id, r }) => `${id} ${Math.round(r.width)}x${Math.round(r.height)}`),
  );
  expect(small).toEqual([]);
});

test('no page zoom, bounce or text selection on the board', async ({ page }) => {
  await open(page);
  const s = await page.evaluate(() => {
    const css = (sel: string, prop: string) =>
      getComputedStyle(document.querySelector(sel)!).getPropertyValue(prop);
    return {
      viewport: document.querySelector('meta[name=viewport]')!.getAttribute('content'),
      stageTouch: css('[data-testid=board-stage]', 'touch-action'),
      bodyPosition: css('body', 'position'),
      overscroll: css('html', 'overscroll-behavior-y'),
      select: css('[data-testid=board-screen]', 'user-select'),
      buttonTouch: css('[data-testid=tool-pen]', 'touch-action'),
    };
  });
  expect(s.viewport).toContain('user-scalable=no');
  expect(s.viewport).toContain('viewport-fit=cover');
  expect(s.stageTouch).toBe('none');
  expect(s.bodyPosition).toBe('fixed');
  expect(s.overscroll).toBe('none');
  expect(s.select).toBe('none');
  expect(s.buttonTouch).toBe('manipulation'); // no double-tap zoom on buttons
});

test('presentation mode shows only the board, with play controls for drills', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await open(page);
  await page.getByTestId('add-home-player').click();
  await page.getByTestId('add-step').click();
  const before = (await page.getByTestId('board-stage').boundingBox())!;

  await page.getByTestId('present').click();
  await expect(page.getByTestId('board-screen')).toHaveAttribute('data-presenting', 'true');
  await expect(page.getByTestId('tool-pen')).toBeHidden();
  await expect(page.getByTestId('add-home-player')).toBeHidden();
  await expect(page.getByTestId('timeline')).toBeHidden();
  await expect(page.getByTestId('present-play')).toBeVisible();
  const during = (await page.getByTestId('board-stage').boundingBox())!;
  expect(during.width * during.height).toBeGreaterThan(before.width * before.height);

  await page.getByTestId('present-play').click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('board-screen')).toHaveAttribute('data-presenting', 'false');
  await expect(page.getByTestId('tool-pen')).toBeVisible();
});
