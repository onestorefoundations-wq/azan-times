import { useSyncExternalStore } from 'react';

function subscribe(cb: () => void): () => void {
  window.addEventListener('resize', cb);
  window.addEventListener('orientationchange', cb);
  return () => {
    window.removeEventListener('resize', cb);
    window.removeEventListener('orientationchange', cb);
  };
}

/** True when the viewport is taller than it is wide. */
export function useIsPortrait(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.innerHeight > window.innerWidth,
    () => false,
  );
}
