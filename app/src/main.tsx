import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import * as viewport from './board/viewport';
import { debugState } from './debug';
import { rinkGeometry, viewBounds } from './model/rink';
import { useBoardStore } from './store/boardStore';
import { useToolStore } from './store/toolStore';
import './styles.css';

if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) {
  Object.assign(window, {
    __floorball: {
      store: useBoardStore,
      tools: useToolStore,
      debugState,
      viewport,
      rinkGeometry,
      viewBounds,
    },
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
