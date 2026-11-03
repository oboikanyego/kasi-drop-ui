import test from 'node:test';
import assert from 'node:assert/strict';
import {
  awakeKey,
  awakeWindowMs,
  giveUpAfterMs,
  needsWake,
  retryDelayMs,
  slowAfterMs,
  wakeApi,
} from '../src/app/wake-api.ts';

const site = { hostname: 'kasi-drop.netlify.app', search: '' };
const json = (body = { name: 'KasiDrop' }, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Time only moves when the code sleeps, so a two-minute wait takes no real time. */
function fakeWorld({ stamp, location = site } = {}) {
  const world = { time: 5_000_000, sleeps: [], scheduled: [], slow: 0, map: new Map() };
  if (stamp !== undefined) world.map.set(awakeKey, String(stamp));
  Object.assign(world, {
    options: {
      location,
      now: () => world.time,
      sleep: async (ms) => {
        world.sleeps.push(ms);
        world.time += ms;
      },
      schedule: (fn, ms) => {
        const entry = { fn, ms, cancelled: false };
        world.scheduled.push(entry);
        return () => (entry.cancelled = true);
      },
      onSlow: () => world.slow++,
      storage: {
        getItem: (key) => world.map.get(key) ?? null,
        setItem: (key, value) => world.map.set(key, value),
      },
    },
  });
  return world;
}
const sequence = (...replies) => {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, init });
    const reply = replies[Math.min(calls.length - 1, replies.length - 1)];
    if (reply instanceof Error) throw reply;
    // A Response body can be read once, so every call gets its own copy.
    return typeof reply === 'function' ? reply() : reply.clone();
  };
  return { fetcher, calls };
};

test('local development skips the wake unless ?wake=1 asks for it', () => {
  const base = { lastAwakeAt: null, now: 1000 };
  for (const hostname of ['localhost', '127.0.0.1', '[::1]'])
    assert.equal(needsWake({ ...base, hostname, search: '' }), false, hostname);
  assert.equal(needsWake({ ...base, hostname: 'localhost', search: '?wake=1' }), true);
  assert.equal(needsWake({ ...base, hostname: 'kasi-drop.netlify.app', search: '' }), true);
});
test('a recent confirmation skips the wake; an old, future or missing one does not', () => {
  const input = { hostname: 'kasi-drop.netlify.app', search: '', now: 10_000_000 };
  assert.equal(needsWake({ ...input, lastAwakeAt: input.now - 1000 }), false);
  assert.equal(needsWake({ ...input, lastAwakeAt: input.now - awakeWindowMs }), false);
  assert.equal(needsWake({ ...input, lastAwakeAt: input.now - awakeWindowMs - 1 }), true);
  assert.equal(needsWake({ ...input, lastAwakeAt: input.now + 5000 }), true);
  assert.equal(needsWake({ ...input, lastAwakeAt: null }), true);
});

test('an awake API is confirmed with one quick request, remembered, and shows no notice', async () => {
  const world = fakeWorld();
  const { fetcher, calls } = sequence(json());
  assert.equal(await wakeApi({ ...world.options, fetcher }), 'awake');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/meta?wake=1');
  assert.equal(calls[0].init.cache, 'no-store');
  assert.equal(calls[0].init.credentials, 'omit');
  assert.equal(calls[0].init.headers.Accept, 'application/json');
  assert.ok(calls[0].init.signal instanceof AbortSignal);
  assert.equal(world.map.get(awakeKey), String(world.time));
  assert.equal(world.slow, 0);
  assert.deepEqual(world.sleeps, []);
});
test('nothing is requested when the API was confirmed awake recently', async () => {
  const world = fakeWorld();
  world.map.set(awakeKey, String(world.time - 60_000));
  const { fetcher, calls } = sequence(json());
  assert.equal(await wakeApi({ ...world.options, fetcher }), 'skipped');
  assert.equal(calls.length, 0);
});
test('a sleeping API is asked again until it answers with JSON', async () => {
  const world = fakeWorld();
  const { fetcher, calls } = sequence(
    new Response('Service Unavailable', { status: 503 }),
    new TypeError('network error'),
    new Response('<html>Your free instance is starting</html>', { status: 200 }),
    new Response('Bad Gateway', { status: 502 }),
    json(),
  );
  assert.equal(await wakeApi({ ...world.options, fetcher }), 'awake');
  assert.equal(calls.length, 5);
  assert.deepEqual(world.sleeps, [retryDelayMs, retryDelayMs, retryDelayMs, retryDelayMs]);
  assert.equal(world.map.get(awakeKey), String(world.time));
});
test('a rate-limited reply still proves the API is awake', async () => {
  const world = fakeWorld();
  const { fetcher } = sequence(new Response('Too many requests', { status: 429 }));
  assert.equal(await wakeApi({ ...world.options, fetcher }), 'awake');
});
test('it gives up after the cap, remembers nothing, and never throws', async () => {
  const world = fakeWorld();
  const start = world.time;
  const { fetcher, calls } = sequence(new Response('Gateway Timeout', { status: 504 }));
  assert.equal(await wakeApi({ ...world.options, fetcher }), 'gave-up');
  assert.ok(world.time - start <= giveUpAfterMs + retryDelayMs, 'waited ' + (world.time - start));
  assert.ok(calls.length > 10);
  assert.equal(world.map.has(awakeKey), false);
});
test('a fetch that throws synchronously is just another failed attempt', async () => {
  const world = fakeWorld();
  const fetcher = () => {
    throw new Error('boom');
  };
  assert.equal(await wakeApi({ ...world.options, fetcher }), 'gave-up');
});

test('the slow notice is scheduled once, fires while still waiting, and is cancelled at the end', async () => {
  const world = fakeWorld();
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  const { fetcher } = sequence(async () => (await gate, json()));
  const done = wakeApi({ ...world.options, fetcher: (url, init) => fetcher(url, init) });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(world.scheduled.length, 1);
  assert.equal(world.scheduled[0].ms, slowAfterMs);
  world.scheduled[0].fn();
  assert.equal(world.slow, 1);
  release();
  assert.equal(await done, 'awake');
  assert.equal(world.scheduled[0].cancelled, true);
});
test('unreadable or read-only storage never blocks the wake', async () => {
  const world = fakeWorld();
  const storage = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('full');
    },
  };
  const { fetcher } = sequence(json());
  assert.equal(await wakeApi({ ...world.options, storage, fetcher }), 'awake');
  world.map.set(awakeKey, 'garbage');
  assert.equal(await wakeApi({ ...world.options, fetcher }), 'awake');
});
