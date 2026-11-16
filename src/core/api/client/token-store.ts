/**
 * Holds the session token when the API uses bearer auth (NEXT_PUBLIC_API_AUTH=bearer).
 * In cookie mode it stays empty: the browser carries the HttpOnly session cookie by itself,
 * which is the safer option and the one to prefer if the client's API supports it.
 *
 * The token lives in memory and in sessionStorage (per tab, cleared when the tab closes) so a reload
 * keeps you signed in. It never goes to localStorage.
 */
export interface TokenStore {
  get(): string | null;
  set(token: string): void;
  clear(): void;
}

const KEY = "storefront.session";

export function createTokenStore(storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null = safeSessionStorage()): TokenStore {
  let token: string | null = null;
  let loaded = false;
  return {
    get() {
      if (!loaded) {
        loaded = true;
        try {
          token = storage?.getItem(KEY) ?? null;
        } catch {
          token = null;
        }
      }
      return token;
    },
    set(next) {
      token = next;
      loaded = true;
      try {
        storage?.setItem(KEY, next);
      } catch {}
    },
    clear() {
      token = null;
      loaded = true;
      try {
        storage?.removeItem(KEY);
      } catch {}
    },
  };
}

function safeSessionStorage() {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}
