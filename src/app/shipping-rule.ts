export type ShippingRule = { freeFrom: number; fee: number };
/** Shown until GET /api/meta answers; the API's rule is the one checkout actually charges. */
export const defaultShippingRule: ShippingRule = { freeFrom: 750, fee: 79 };
/** Accept the API's published rule only when both amounts are sensible numbers. */
export function parseShippingRule(value: unknown): ShippingRule | null {
  const rule = value as Partial<ShippingRule> | null;
  const valid = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0;
  return rule && valid(rule.freeFrom) && valid(rule.fee)
    ? { freeFrom: rule.freeFrom!, fee: rule.fee! }
    : null;
}
/** Delivery fee for a subtotal: free for an empty bag or at the threshold, otherwise the fee. */
export const shippingFor = (subtotal: number, rule: ShippingRule) =>
  subtotal === 0 || subtotal >= rule.freeFrom ? 0 : rule.fee;
