// Serves the production build plus a recording stub of the KasiDrop API for browser tests.
import http from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { products } from './stub-server-data.mjs';

const root = resolve('dist/kasi-drop-ui');
const port = Number(process.env.E2E_PORT || 4310);
const base = 'http://localhost:' + port;
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};
const address = {
  id: 'addr-1',
  label: 'Home',
  nickname: '',
  recipientName: 'Thandi Mokoena',
  phone: '0821234567',
  street: '12 Vilakazi Street',
  unit: 'Flat 3',
  suburb: 'Orlando West',
  city: 'Soweto',
  province: 'Gauteng',
  postalCode: '1804',
  deliveryNotes: '',
  isDefault: true,
};
// Sessions: kasi_session=<base64url JSON user>, httpOnly like the real API's cookie.
export const encodeSession = (user) => Buffer.from(JSON.stringify(user)).toString('base64url');
const sessionUser = (req) => {
  const match = /(?:^|;\s*)kasi_session=([^;]+)/.exec(req.headers.cookie || '');
  try {
    return match ? JSON.parse(Buffer.from(match[1], 'base64url').toString()) : null;
  } catch {
    return null;
  }
};
const sessionCookie = (user) =>
  'kasi_session=' + encodeSession(user) + '; Path=/api; HttpOnly; SameSite=Lax';
const legacyUser = {
  id: 'u-1',
  name: 'Thandi Mokoena',
  email: 'thandi@example.com',
  role: 'customer',
};
// Endpoints any visitor may call; everything else needs the session cookie, like the real API.
const publicRoutes = [
  'GET /api/meta',
  'GET /api/products',
  'POST /api/auth/login',
  'POST /api/auth/session',
  'POST /api/auth/logout',
  'POST /api/ai/chat',
];
let state;
function reset(options = {}) {
  state = {
    demoMode: options.demoMode ?? true,
    orders: options.orders ?? [],
    // orderId -> statuses returned on successive GET /api/orders calls (the last one repeats).
    sequences: options.sequences ?? {},
    listCalls: 0,
    requests: [],
  };
}
reset();
const send = (res, status, body, type = 'application/json') => {
  res.writeHead(status, { 'content-type': type });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
};
const readBody = (req) =>
  new Promise((done) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => done(data));
  });
function ordersNow() {
  const call = state.listCalls++;
  return state.orders.map((o) => {
    const seq = state.sequences[o.id];
    return seq ? { ...o, status: seq[Math.min(call, seq.length - 1)] } : o;
  });
}
function newOrder(payload, status) {
  const lines = payload.items.map((item) => {
    const p = products.find((x) => x.id === item.productId);
    return {
      productId: p.id,
      name: p.name,
      price: p.price,
      quantity: item.quantity,
      image: p.image,
    };
  });
  const subtotal = lines.reduce((n, l) => n + l.price * l.quantity, 0);
  const shipping = subtotal >= 750 ? 0 : 79;
  const order = {
    id: 'ord-' + (state.orders.length + 1),
    items: lines,
    subtotal,
    shipping,
    total: subtotal + shipping,
    status,
    createdAt: new Date().toISOString(),
    delivery: payload.delivery,
  };
  state.orders.unshift(order);
  return order;
}
async function api(req, res, path) {
  const raw = await readBody(req);
  const body = raw && (req.headers['content-type'] || '').includes('json') ? JSON.parse(raw) : raw;
  state.requests.push({
    method: req.method,
    path,
    body,
    auth: req.headers.authorization || '',
    cookie: req.headers.cookie || '',
    csrf: req.headers['x-kasidrop-csrf'] || '',
  });
  const route = req.method + ' ' + path;
  const user = sessionUser(req);
  const isPublic = publicRoutes.includes(route) || route.startsWith('GET /api/products/');
  if (!isPublic && !user) return send(res, 401, { error: 'Sign in required' });
  if (!isPublic && req.method !== 'GET' && !req.headers['x-kasidrop-csrf'])
    return send(res, 403, { error: 'Missing CSRF header' });
  if (route === 'GET /api/auth/me') return send(res, 200, { user });
  if (route === 'POST /api/auth/login') {
    if (body.password !== 'Demo@12345')
      return send(res, 401, { error: 'Invalid email or password' });
    const signedIn = { ...legacyUser, email: body.email };
    res.setHeader('set-cookie', sessionCookie(signedIn));
    // The real API still returns the token for older clients; the UI must not keep it.
    return send(res, 200, { user: signedIn, token: 'body-token-must-not-be-stored' });
  }
  if (route === 'POST /api/auth/session') {
    if (req.headers.authorization !== 'Bearer legacy-jwt')
      return send(res, 401, { error: 'Sign in required' });
    res.setHeader('set-cookie', sessionCookie(legacyUser));
    return send(res, 200, { user: legacyUser });
  }
  if (route === 'POST /api/auth/logout') {
    res.setHeader('set-cookie', 'kasi_session=; Path=/api; HttpOnly; SameSite=Lax; Max-Age=0');
    res.writeHead(204);
    return res.end();
  }
  if (route === 'GET /api/meta')
    return send(res, 200, {
      categories: ['All'],
      demoMode: state.demoMode,
      aiEnabled: false,
      checkoutEnabled: true,
      shipping: { freeFrom: 750, fee: 79 },
    });
  if (route === 'GET /api/products') return send(res, 200, { products, total: products.length });
  if (route.startsWith('GET /api/products/')) {
    const p = products.find((x) => x.id === path.split('/').pop());
    return p ? send(res, 200, { product: p, similar: [] }) : send(res, 404, { error: 'Not found' });
  }
  if (route === 'GET /api/favorites') return send(res, 200, { productIds: [] });
  if (route === 'GET /api/profile')
    return send(res, 200, {
      profile: {
        id: 'u-1',
        name: 'Thandi Mokoena',
        email: 'thandi@example.com',
        role: 'customer',
        phone: '0821234567',
        about: '',
        preferredLanguage: 'English',
        marketingOptIn: false,
        memberSince: null,
        avatarUpdatedAt: null,
        addresses: [address],
      },
    });
  if (route === 'POST /api/orders/checkout') {
    if (body.paymentMethod === 'demo') {
      const order = newOrder(body, 'demo_paid');
      return send(res, 201, {
        order,
        payment: null,
        warning: 'Simulated payment only. No money was charged.',
      });
    }
    const order = newOrder(body, 'pending_payment');
    return send(res, 201, {
      order,
      payment: {
        url: base + '/__stub/payfast',
        fields: {
          merchant_id: '10000100',
          m_payment_id: order.id,
          amount: order.total.toFixed(2),
          signature: 'test-signature',
        },
      },
    });
  }
  if (route === 'GET /api/orders') return send(res, 200, { orders: ordersNow() });
  if (route === 'GET /api/admin/summary')
    return send(res, 200, {
      products: products.length,
      lowStock: 1,
      orders: state.orders.length,
      demoOrders: 0,
      revenue: 219,
      simulatedRevenue: 0,
      recentOrders: state.orders.slice(0, 10),
    });
  if (route === 'GET /api/admin/orders') return send(res, 200, { orders: state.orders });
  if (req.method === 'PATCH' && path.startsWith('/api/admin/orders/')) {
    const order = state.orders.find((o) => o.id === path.split('/').pop());
    if (!order) return send(res, 404, { error: 'Not found' });
    order.status = body.status;
    return send(res, 200, { ok: true, status: body.status });
  }
  if (route === 'POST /api/admin/products')
    return send(res, 201, { product: { ...body, id: 'new-product' } });
  if (req.method === 'PATCH' && path.startsWith('/api/admin/products/'))
    return send(res, 200, {
      product: { ...products.find((p) => p.id === path.split('/').pop()), ...body },
    });
  return send(res, 404, { error: 'Not found' });
}
http
  .createServer(async (req, res) => {
    const url = new URL(req.url, base);
    if (url.pathname === '/__stub/health') return send(res, 200, { ok: true });
    if (url.pathname === '/__stub/reset')
      return (reset(JSON.parse((await readBody(req)) || '{}')), send(res, 200, { ok: true }));
    if (url.pathname === '/__stub/requests') return send(res, 200, state.requests);
    if (url.pathname === '/__stub/payfast') {
      const form = Object.fromEntries(new URLSearchParams(await readBody(req)));
      state.requests.push({ method: req.method, path: url.pathname, body: form });
      return send(res, 200, '<h1>PayFast sandbox (stub)</h1>', 'text/html');
    }
    if (url.pathname.startsWith('/api/')) return api(req, res, url.pathname);
    // Static build; relative asset URLs under deep links fall back to the file by name.
    let file = join(root, url.pathname);
    if (!existsSync(file) || statSync(file).isDirectory()) {
      const byName = join(root, url.pathname.split('/').pop());
      file = extname(byName) && existsSync(byName) ? byName : join(root, 'index.html');
    }
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
    res.end(readFileSync(file));
  })
  .listen(port, () => console.log('e2e stub on ' + base));
