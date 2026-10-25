/** Where UIs released before the httpOnly session cookie kept the login token. */
export const legacyTokenKey = 'kasi_token';
type Store = Pick<Storage, 'getItem' | 'removeItem'>;
/**
 * Swap a token an older UI left in localStorage for the httpOnly session cookie. Runs before the
 * app boots so no request goes out without the cookie. The token is removed once the API has
 * answered; a rejected token also forgets the remembered user. After a network failure the token
 * is kept so the next visit can try again.
 */
export async function migrateLegacySession(
  storage: Store = localStorage,
  fetcher: typeof fetch = fetch,
): Promise<'none' | 'migrated' | 'rejected' | 'offline'> {
  let token: string | null = null;
  try {
    token = storage.getItem(legacyTokenKey);
  } catch {
    return 'none';
  }
  if (!token) return 'none';
  let response: Response;
  try {
    response = await fetcher('/api/auth/session', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'X-KasiDrop-CSRF': '1' },
      credentials: 'same-origin',
    });
  } catch {
    return 'offline';
  }
  storage.removeItem(legacyTokenKey);
  if (response.ok) return 'migrated';
  storage.removeItem('kasi_user');
  return 'rejected';
}
