/**
 * Wakes the API before the app boots. Render's free tier puts the API to sleep after 15 minutes
 * without traffic, and the first request then waits for it to start (30-60s). Asking for
 * GET /api/meta first, while a splash screen is showing, means the app never boots against a
 * sleeping API and falls back to its offline preview. The API only starts listening once it is
 * connected to its database, so any real answer from it means it is ready.
 */
export const awakeKey = 'kasi_api_awake_at';
/** Render sleeps after 15 minutes; a confirmation younger than this means it cannot be asleep. */
export const awakeWindowMs = 10 * 60_000;
/** Netlify's proxy gives up on a request after 26s, so waiting longer for one attempt is pointless. */
export const attemptTimeoutMs = 20_000;
export const retryDelayMs = 2_000;
/** After this the app boots anyway and shows its offline preview, as it does for any API outage. */
export const giveUpAfterMs = 120_000;
/** Until now the splash is just a spinner; after it, the page explains why it is waiting. */
export const slowAfterMs = 3_000;
/** An attempt with less time than this left could not finish, so it is not started. */
export const minAttemptMs = 1_000;

export type WakeOutcome = 'awake' | 'skipped' | 'gave-up';
type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;
export type WakeOptions = {
  fetcher?: typeof fetch;
  storage?: KeyValueStore;
  location?: Pick<Location, 'hostname' | 'search'>;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  /** Run `fn` after `ms`; returns a function that cancels it. */
  schedule?: (fn: () => void, ms: number) => () => void;
  /** Called once if the API has not answered after `slowAfterMs`. */
  onSlow?: () => void;
  /** Overrides `giveUpAfterMs`, e.g. a shorter wait when the check is blocking a page in use. */
  giveUpAfterMs?: number;
};

/** Run `fn` after `ms` with a real timer; returns a function that cancels it. */
export function timerSchedule(fn: () => void, ms: number): () => void {
  const timer = setTimeout(fn, ms);
  return () => clearTimeout(timer);
}

const localHosts = ['localhost', '127.0.0.1', '[::1]'];
/**
 * Whether to check the API before booting. Local development never sleeps, so it is skipped
 * unless the page is opened with ?wake=1. A recent confirmation in this browser also skips the
 * check, so reloads and new tabs boot straight away.
 */
export function needsWake(input: {
  hostname: string;
  search: string;
  lastAwakeAt: number | null;
  now: number;
}): boolean {
  const forced = new URLSearchParams(input.search).get('wake') === '1';
  if (!forced && localHosts.includes(input.hostname)) return false;
  const { lastAwakeAt, now } = input;
  // A stamp from the future means the clock changed, so it proves nothing.
  const recent = lastAwakeAt !== null && lastAwakeAt <= now && now - lastAwakeAt <= awakeWindowMs;
  return !recent;
}

/** True for a real answer from the API: JSON, or a rate-limit reply (it is clearly awake). */
async function answeredByApi(response: Response): Promise<boolean> {
  if (response.status === 429) return true;
  if (!response.ok) return false;
  try {
    const body: unknown = await response.json();
    // Render's start-up page and a failed proxy are HTML, not JSON.
    return typeof body === 'object' && body !== null;
  } catch {
    return false;
  }
}

async function askApi(fetcher: typeof fetch, timeoutMs: number): Promise<boolean> {
  try {
    const response = await fetcher('/api/meta?wake=1', {
      cache: 'no-store',
      credentials: 'omit',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    return await answeredByApi(response);
  } catch {
    return false; // offline, aborted or refused: try again
  }
}

function readStamp(storage: KeyValueStore | undefined): number | null {
  try {
    const stamp = Number(storage?.getItem(awakeKey));
    return Number.isFinite(stamp) && stamp > 0 ? stamp : null;
  } catch {
    return null;
  }
}

/**
 * Keep asking the API until it answers. Resolves 'awake' once it has, 'skipped' when a recent
 * check makes that unnecessary, or 'gave-up' after `giveUpAfterMs` (the caller should boot
 * anyway). Never rejects.
 */
export async function wakeApi(options: WakeOptions = {}): Promise<WakeOutcome> {
  const now = options.now ?? Date.now;
  const sleep =
    options.sleep ?? ((ms: number) => new Promise<void>((done) => setTimeout(done, ms)));
  const schedule = options.schedule ?? timerSchedule;
  const giveUpAfter = options.giveUpAfterMs ?? giveUpAfterMs;
  let storage = options.storage;
  let place = options.location;
  try {
    storage ??= localStorage;
    place ??= location;
  } catch {
    // No browser globals or blocked storage: carry on without them.
  }
  const fetcher = options.fetcher ?? fetch;
  if (
    !needsWake({
      hostname: place?.hostname ?? '',
      search: place?.search ?? '',
      lastAwakeAt: readStamp(storage),
      now: now(),
    })
  )
    return 'skipped';

  const started = now();
  const cancelSlow = schedule(() => options.onSlow?.(), slowAfterMs);
  try {
    for (;;) {
      const timeout = Math.min(attemptTimeoutMs, giveUpAfter - (now() - started));
      if (timeout < minAttemptMs) return 'gave-up';
      if (await askApi(fetcher, timeout)) {
        try {
          storage?.setItem(awakeKey, String(now()));
        } catch {
          // Storage is only an optimisation; a failed write just means checking again next load.
        }
        return 'awake';
      }
      await sleep(retryDelayMs);
    }
  } finally {
    cancelSlow();
  }
}
