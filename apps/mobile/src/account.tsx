/**
 * The signed-in account, and syncing with it.
 *
 * The session token is a credential, so it goes in SecureStore — the Keychain
 * on iOS, the Keystore on Android — and never in AsyncStorage next to the
 * learner's progress. The password is never stored anywhere.
 *
 * Sync is manual for now. Doing it automatically needs a policy about metered
 * connections and background execution, and guessing at one would be worse than
 * a button that says what it did.
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import { NO_SYNC, syncProgress, type SyncBookmark, type SyncOutcome } from '@nemcina/core';
import { api, syncConfigured, type Account } from './api';
import { LOCAL_USER, useProgress } from './progress';

const TOKEN_KEY = 'nemcina.session.token';
/** The bookmark is not a secret; it lives with the progress it describes. */
const BOOKMARK_KEY = 'nemcina.sync.bookmark';

interface AccountContextValue {
  readonly account: Account | null;
  /**
   * The session token, for the one call that is not made through this context.
   * It stays in memory only; SecureStore remains the single place it is written.
   */
  readonly token: string | null;
  readonly ready: boolean;
  readonly configured: boolean;
  readonly bookmark: SyncBookmark;
  register(email: string, password: string): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;
  sync(options?: { full?: boolean }): Promise<SyncOutcome>;
}

const AccountContext = createContext<AccountContextValue | null>(null);

/** SecureStore is unavailable on web; fall back so the export still runs. */
async function readSecret(key: string): Promise<string | null> {
  try { return await SecureStore.getItemAsync(key); } catch { return null; }
}
async function writeSecret(key: string, value: string | null): Promise<void> {
  try {
    if (value === null) await SecureStore.deleteItemAsync(key);
    else await SecureStore.setItemAsync(key, value);
  } catch {
    // A device that refuses to keep the token means signing in again next
    // launch. That is a worse experience, not a broken app.
  }
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const { store, reload } = useProgress();
  const [token, setToken] = useState<string | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [bookmark, setBookmark] = useState<SyncBookmark>(NO_SYNC);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await readSecret(TOKEN_KEY);
      if (cancelled) return;
      if (stored && syncConfigured()) {
        try {
          const me = await api.me(stored);
          if (!cancelled) { setToken(stored); setAccount(me.account); }
        } catch {
          // The session expired or was revoked elsewhere. Drop it quietly;
          // the learner will be asked to sign in when they look.
          await writeSecret(TOKEN_KEY, null);
        }
      }
      if (!cancelled) setReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const adopt = useCallback(async (session: { token: string; account: Account }) => {
    await writeSecret(TOKEN_KEY, session.token);
    setToken(session.token);
    setAccount(session.account);
    // A new sign-in has no idea what this device already holds, so the first
    // sync is a full one.
    setBookmark(NO_SYNC);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    await adopt(await api.register(email, password));
  }, [adopt]);

  const signIn = useCallback(async (email: string, password: string) => {
    await adopt(await api.signIn(email, password));
  }, [adopt]);

  const signOut = useCallback(async () => {
    const current = token;
    setToken(null);
    setAccount(null);
    setBookmark(NO_SYNC);
    await writeSecret(TOKEN_KEY, null);
    // Tell the server after clearing locally: if the call fails, the device is
    // still signed out, which is the half that matters to the person holding it.
    if (current) { try { await api.signOut(current); } catch { /* already local */ } }
  }, [token]);

  const deleteAccount = useCallback(async () => {
    if (!token) return;
    await api.deleteAccount(token);
    setToken(null);
    setAccount(null);
    setBookmark(NO_SYNC);
    await writeSecret(TOKEN_KEY, null);
  }, [token]);

  const sync = useCallback(async (options: { full?: boolean } = {}) => {
    if (!token) throw new Error('sign in before syncing');
    const outcome = await syncProgress(
      store,
      { push: (records, since) => api.sync(token, records, since) },
      LOCAL_USER,
      bookmark,
      options,
    );
    setBookmark(outcome.bookmark);
    // The store changed underneath every screen; make them see it.
    await reload();
    return outcome;
  }, [token, store, bookmark, reload]);

  const value = useMemo<AccountContextValue>(() => ({
    account, token, ready, configured: syncConfigured(), bookmark,
    register, signIn, signOut, deleteAccount, sync,
  }), [account, token, ready, bookmark, register, signIn, signOut, deleteAccount, sync]);

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountContextValue {
  const value = useContext(AccountContext);
  if (!value) throw new Error('useAccount must be used inside AccountProvider');
  return value;
}

export { BOOKMARK_KEY };
