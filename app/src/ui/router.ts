import { useSyncExternalStore } from 'react';

// Hash routes, so the app works from a file or app-store wrapper without a server:
//   #/          board library
//   #/new       create a board and open it
//   #/sample    add a copy of the sample drill and open it
//   #/b/<id>    one board
export type Route =
  { name: 'library' } | { name: 'new' } | { name: 'sample' } | { name: 'board'; id: string };

export function parseRoute(hash: string): Route {
  const h = hash.replace(/^#/, '');
  if (h === '/new') return { name: 'new' };
  if (h === '/sample') return { name: 'sample' };
  const m = /^\/b\/([^/]+)$/.exec(h);
  if (m) return { name: 'board', id: decodeURIComponent(m[1]!) };
  return { name: 'library' };
}

export function navigate(hash: string, replace = false): void {
  if (replace) {
    history.replaceState(null, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    location.hash = hash;
  }
}

export const boardHash = (id: string) => `#/b/${encodeURIComponent(id)}`;

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => location.hash);
  return parseRoute(hash);
}
