import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const cart = readFileSync('src/app/store.service.ts', 'utf8');
const checkout = readFileSync('src/app/customer.pages.ts', 'utf8');
const orders = readFileSync('src/app/orders.page.html', 'utf8');

test('payment redirect remembers the pending order before leaving the application', () => {
  assert.match(checkout, /rememberPendingCheckout\(r\.order\.id,items\)/);
  assert.ok(
    checkout.indexOf('rememberPendingCheckout(r.order.id,items)') <
      checkout.indexOf('form.submit()'),
  );
});
test('cart reconciliation requires matching order id and a verified paid status', () => {
  assert.match(cart, /pending\.orderId!==order\.id/);
  assert.match(
    cart,
    /\['paid','processing','shipped','delivered','demo_paid'\]\.includes\(order\.status\)/,
  );
  assert.match(cart, /sessionStorage\.removeItem\('kasi_pending_checkout'\)/);
});
test('only purchased quantities are removed, leaving unpurchased items in cart', () => {
  assert.match(cart, /if\(!purchased\)return \[line\]/);
  assert.match(cart, /const left=line\.quantity-purchased\.quantity/);
  assert.match(cart, /left>0\?\[\{\.\.\.line,quantity:left\}\]:\[\]/);
});
test('browser return URL is not used as proof of payment', () => {
  assert.match(checkout, /this\.store\.completeVerifiedCheckout\(matching\)/);
  assert.match(checkout, /if\(returnStatus==='return'&&this\.store\.pendingCheckout\(\)\)/);
  assert.match(checkout, /this\.api\.orders\(\)/);
  assert.doesNotMatch(checkout, /if\(returnStatus==='return'\)this\.store\.clear/);
});
test('orders page explains pending verification and supports refresh', () => {
  assert.match(orders, /paymentNotice/);
  assert.match(orders, /\(click\)="refresh\(\)"/);
});
