// Offline support (PLAN.md M6). The service worker precaches the whole app, so after one
// visit it opens with no network. Boards live in IndexedDB; we ask the browser to keep them.

import { registerSW } from 'virtual:pwa-register';

export function setupOffline(): void {
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    // autoUpdate: a new version is fetched in the background and used on the next launch.
    registerSW({ immediate: true });
  }
  // Ask for persistent storage so iOS/Chrome do not evict saved boards under pressure.
  // Best effort: browsers may say no, and some only allow it once installed.
  void navigator.storage?.persist?.().catch(() => false);
}
