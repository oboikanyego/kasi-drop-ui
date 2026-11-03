import type { WakeOutcome } from './wake-api';

/** The loader only appears if the check is still running after this, so a quick "awake" never flashes. */
export const overlayDelayMs = 400;
/** The page is covered while this runs, so it waits less than the first-visit check does. */
export const returnGiveUpAfterMs = 90_000;
/** After a check gives up the API is probably down, not asleep: don't cover the page again for this long. */
export const retryAfterGiveUpMs = 5 * 60_000;

type Target = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
export type ReturnWatchOptions = {
  document: Target & { readonly visibilityState: string };
  window: Target;
  /** The wake-up check; it decides for itself whether one is needed (see needsWake). */
  wake: () => Promise<WakeOutcome>;
  overlay: { show: () => void; hide: () => void };
  now?: () => number;
  /** Run `fn` after `ms`; returns a function that cancels it (see timerSchedule). */
  schedule: (fn: () => void, ms: number) => () => void;
};

/**
 * A tab left open can outlive the API's sleep: Render stops it after 15 minutes without traffic,
 * and the next click would then wait for it to start. So whenever the tab becomes visible or
 * regains focus, run the wake-up check. If it answers at once nothing is shown; if it does not,
 * a loader covers the page until the API is back. Returns a function that stops watching.
 */
export function watchForReturn(options: ReturnWatchOptions): () => void {
  const now = options.now ?? Date.now;
  let running = false;
  let gaveUpAt: number | null = null;

  async function check() {
    if (running || options.document.visibilityState !== 'visible') return;
    if (gaveUpAt !== null) {
      const since = now() - gaveUpAt;
      if (since >= 0 && since < retryAfterGiveUpMs) return;
    }
    running = true;
    const cancelOverlay = options.schedule(() => options.overlay.show(), overlayDelayMs);
    try {
      gaveUpAt = (await options.wake()) === 'gave-up' ? now() : null;
    } catch {
      gaveUpAt = now(); // wakeApi never rejects, but the page must never stay covered
    } finally {
      cancelOverlay();
      options.overlay.hide();
      running = false;
    }
  }
  const onReturn = () => void check();
  options.document.addEventListener('visibilitychange', onReturn);
  options.window.addEventListener('focus', onReturn);
  return () => {
    options.document.removeEventListener('visibilitychange', onReturn);
    options.window.removeEventListener('focus', onReturn);
  };
}
