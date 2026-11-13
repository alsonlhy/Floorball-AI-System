// Read-only hooks for Playwright and manual debugging. Attached to window in dev builds
// or when the URL has ?debug.

import type { Viewport } from './board/viewport';

export const debugState: { viewport: Viewport | null } = { viewport: null };
