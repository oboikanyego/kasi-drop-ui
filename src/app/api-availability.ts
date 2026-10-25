/**
 * Whether a failed request means the API itself is unreachable, so browsing may fall back to the
 * offline preview catalogue. A 404 carrying the API's own JSON error body is a real "not found"
 * and must surface as such; any other 404 (e.g. the host has no service running) means unavailable.
 */
export function isApiUnavailable(error: any): boolean {
  if (error?.name === 'TimeoutError' || [0, 502, 503, 504].includes(error?.status)) return true;
  return error?.status === 404 && typeof error?.error?.error !== 'string';
}
