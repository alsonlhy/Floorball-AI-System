import type { Page } from '@playwright/test';

export interface Snapshot {
  entities: { id: string; kind: string; team?: string; label?: string }[];
  positions: Record<string, { x: number; y: number }>;
  selection: string[];
  rink: { lengthM: number; widthM: number; view: string };
}

type W = {
  __floorball: {
    store: {
      getState(): {
        board: {
          entities: Snapshot['entities'];
          frames: { positions: Snapshot['positions'] }[];
          rink: Snapshot['rink'];
        };
        selection: string[];
      };
    };
    debugState: {
      viewport: { scale: number; offsetX: number; offsetY: number; rotation: 0 | 90 } | null;
    };
    viewport: {
      rinkToScreen(
        p: { x: number; y: number },
        vp: unknown,
      ): {
        x: number;
        y: number;
      };
    };
  };
};

export async function snapshot(page: Page): Promise<Snapshot> {
  return page.evaluate(() => {
    const s = (window as unknown as W).__floorball.store.getState();
    return {
      entities: s.board.entities,
      positions: s.board.frames[0]!.positions,
      selection: s.selection,
      rink: s.board.rink,
    };
  });
}

export async function viewportOf(page: Page) {
  return page.evaluate(() => (window as unknown as W).__floorball.debugState.viewport!);
}

/** Page coordinates of a rink point, via the app's own rinkToScreen. */
export async function rinkToPage(page: Page, p: { x: number; y: number }) {
  return page.evaluate((pt) => {
    const f = (window as unknown as W).__floorball;
    const s = f.viewport.rinkToScreen(pt, f.debugState.viewport);
    const r = document.querySelector('[data-testid="board-stage"]')!.getBoundingClientRect();
    return { x: r.left + s.x, y: r.top + s.y };
  }, p);
}

export async function entityPagePos(page: Page, id: string) {
  const snap = await snapshot(page);
  return rinkToPage(page, snap.positions[id]!);
}

export async function stageBox(page: Page) {
  return (await page.getByTestId('board-stage').boundingBox())!;
}
