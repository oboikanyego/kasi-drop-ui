import test from 'node:test';
import assert from 'node:assert/strict';
import { overlayDelayMs, retryAfterGiveUpMs, watchForReturn } from '../src/app/wake-on-return.ts';

/** A tab whose events the test fires by hand, with its own clock, timers and overlay. */
function fakeTab({ visibility = 'visible', outcomes = ['awake'] } = {}) {
  const tab = {
    time: 1_000_000,
    wakes: 0,
    shown: 0,
    hidden: 0,
    scheduled: [],
    listeners: new Map(),
    document: null,
    window: null,
  };
  const target = (extra = {}) => ({
    ...extra,
    addEventListener: (type, fn) => tab.listeners.set(type, fn),
    removeEventListener: (type) => tab.listeners.delete(type),
  });
  tab.document = target({ visibilityState: visibility });
  tab.window = target();
  tab.fire = async (type) => {
    tab.listeners.get(type)?.();
    await new Promise((resolve) => setImmediate(resolve));
  };
  tab.options = {
    document: tab.document,
    window: tab.window,
    wake: async () => {
      const outcome = outcomes[Math.min(tab.wakes++, outcomes.length - 1)];
      if (outcome instanceof Error) throw outcome;
      if (typeof outcome === 'function') return outcome();
      return outcome;
    },
    overlay: { show: () => tab.shown++, hide: () => tab.hidden++ },
    now: () => tab.time,
    schedule: (fn, ms) => {
      const entry = { fn, ms, cancelled: false };
      tab.scheduled.push(entry);
      return () => (entry.cancelled = true);
    },
  };
  return tab;
}

test('coming back to a tab runs the wake check, and an instant answer shows nothing', async () => {
  const tab = fakeTab({ outcomes: ['skipped'] });
  watchForReturn(tab.options);
  await tab.fire('visibilitychange');
  assert.equal(tab.wakes, 1);
  // The loader was scheduled but cancelled before it could appear.
  assert.equal(tab.scheduled[0].ms, overlayDelayMs);
  assert.equal(tab.scheduled[0].cancelled, true);
  assert.equal(tab.shown, 0);
  assert.equal(tab.hidden, 1);
});
test('regaining window focus counts as coming back too', async () => {
  const tab = fakeTab();
  watchForReturn(tab.options);
  await tab.fire('focus');
  assert.equal(tab.wakes, 1);
});
test('a check that takes a while covers the page, and uncovers it when the API answers', async () => {
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  const tab = fakeTab({ outcomes: [() => gate.then(() => 'awake')] });
  watchForReturn(tab.options);
  tab.listeners.get('visibilitychange')();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(tab.shown, 0);
  tab.scheduled[0].fn(); // the delay elapses while the API is still waking
  assert.equal(tab.shown, 1);
  assert.equal(tab.hidden, 0);
  release();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(tab.hidden, 1);
  assert.equal(tab.scheduled[0].cancelled, true);
});
test('a tab that is not visible is ignored', async () => {
  const tab = fakeTab({ visibility: 'hidden' });
  watchForReturn(tab.options);
  await tab.fire('visibilitychange');
  await tab.fire('focus');
  assert.equal(tab.wakes, 0);
  assert.equal(tab.shown + tab.hidden, 0);
});
test('visibility and focus firing together start only one check', async () => {
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  const tab = fakeTab({ outcomes: [() => gate.then(() => 'awake')] });
  watchForReturn(tab.options);
  tab.listeners.get('visibilitychange')();
  tab.listeners.get('focus')();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(tab.wakes, 1);
  release();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(tab.hidden, 1);
});
test('after giving up it leaves the page alone for a while, then tries again', async () => {
  const tab = fakeTab({ outcomes: ['gave-up', 'gave-up', 'awake'] });
  watchForReturn(tab.options);
  await tab.fire('visibilitychange');
  assert.equal(tab.wakes, 1);
  tab.time += retryAfterGiveUpMs - 1;
  await tab.fire('visibilitychange');
  assert.equal(tab.wakes, 1, 'still cooling down');
  tab.time += 1;
  await tab.fire('visibilitychange');
  assert.equal(tab.wakes, 2);
  tab.time += retryAfterGiveUpMs; // gave up again: another cooldown
  await tab.fire('visibilitychange');
  assert.equal(tab.wakes, 3);
  await tab.fire('visibilitychange'); // the success cleared it: no cooldown now
  assert.equal(tab.wakes, 4);
});
test('a wake check that throws still uncovers the page', async () => {
  const tab = fakeTab({ outcomes: [new Error('boom')] });
  watchForReturn(tab.options);
  await tab.fire('visibilitychange');
  assert.equal(tab.hidden, 1);
  await tab.fire('visibilitychange');
  assert.equal(tab.wakes, 1, 'treated as a give-up, so it waits before retrying');
});
test('stopping the watch removes both listeners', () => {
  const tab = fakeTab();
  const stop = watchForReturn(tab.options);
  assert.deepEqual([...tab.listeners.keys()].sort(), ['focus', 'visibilitychange']);
  stop();
  assert.equal(tab.listeners.size, 0);
});
