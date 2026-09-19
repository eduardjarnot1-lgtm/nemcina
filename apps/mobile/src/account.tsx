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
import { firebaseConfigured } from './firebaseConfig';
import {
  createAccount, pullProgress, pushProgress, signInWithPassword, signOutOfFirebase, watchUser,
} from './firebaseAuth';

/**
 * Which service holds accounts.
 *
 * `packages/server` is the better design and is still the first choice, but it
 * needs a deployment that does not exist: `EXPO_PUBLIC_API_URL` has no default,
 * so without one it could never sign anyone in. Firebase is already running and
 * the web prototype already writes to it, so it takes over when the server is
 * absent — and the two clients then share one account per learner.
 */
export type AccountBackend = 'server' | 'firebase' | 'none';

export const accountBackend = (): AccountBackend => {
  if (syncConfigured()) return 'server';
  if (firebaseConfigured()) return 'firebase';
  return 'none';
};

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
  const backend = accountBackend();
  const [firebaseUid, setFirebaseUid] = useState<string | null>(null);

  // Firebase keeps its own session across launches, so the app is told who is
  // signed in rather than storing a token itself.
  useEffect(() => {
    if (backend !== 'firebase') return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    void watchUser((user) => {
      if (cancelled) return;
      setFirebaseUid(user?.uid ?? null);
      setAccount(user
        ? { id: user.uid, email: user.email ?? '', tier: 'free', premiumUntil: 0 }
        : null);
      setReady(true);
    }).then((unsubscribe) => {
      if (cancelled) unsubscribe();
      else stop = unsubscribe;
    });
    return () => { cancelled = true; stop?.(); };
  }, [backend]);

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
      // Firebase reports readiness from its own listener above.
      if (!cancelled && backend !== 'firebase') setReady(true);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (backend === 'firebase') {
      await createAccount(email, password);
      setBookmark(NO_SYNC);
      return;
    }
    await adopt(await api.register(email, password));
  }, [adopt, backend]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (backend === 'firebase') {
      await signInWithPassword(email, password);
      setBookmark(NO_SYNC);
      return;
    }
    await adopt(await api.signIn(email, password));
  }, [adopt, backend]);

  const signOut = useCallback(async () => {
    if (backend === 'firebase') {
      await signOutOfFirebase();
      setBookmark(NO_SYNC);
      return;
    }
    const current = token;
    setToken(null);
    setAccount(null);
    setBookmark(NO_SYNC);
    await writeSecret(TOKEN_KEY, null);
    // Tell the server after clearing locally: if the call fails, the device is
    // still signed out, which is the half that matters to the person holding it.
    if (current) { try { await api.signOut(current); } catch { /* already local */ } }
  }, [token, backend]);

  const deleteAccount = useCallback(async () => {
    if (backend === 'firebase') {
      // Deleting a Firebase account needs a recent sign-in and a confirmation
      // this panel does not yet ask for. Signing out is what it does instead,
      // rather than half-deleting and leaving the learner unsure.
      await signOutOfFirebase();
      return;
    }
    if (!token) return;
    await api.deleteAccount(token);
    setToken(null);
    setAccount(null);
    setBookmark(NO_SYNC);
    await writeSecret(TOKEN_KEY, null);
  }, [token, backend]);

  const sync = useCallback(async (options: { full?: boolean } = {}) => {
    if (backend === 'firebase') {
      if (!firebaseUid) throw new Error('sign in before syncing');
      // Push what this device knows, then take back everything the account
      // holds and merge it in. The merge rule lives in the core, so the phone
      // and the browser cannot disagree about which review is newer.
      const local = await store.all(LOCAL_USER);
      const accepted = await pushProgress(firebaseUid, local);
      const remote = await pullProgress(firebaseUid);
      const outcome = await syncProgress(
        store,
        {
          // Firestore has no merge endpoint, so this transport is the two calls
          // above dressed as one: everything already went up, and everything
          // the account holds comes back as `changed`. The core still decides
          // which record wins, so the phone and the browser cannot disagree.
          push: async () => ({
            changed: remote,
            syncedAt: Date.now(),
            accepted,
            rejected: 0,
          }),
        },
        LOCAL_USER,
        bookmark,
        { ...options, full: true },
      );
      setBookmark(outcome.bookmark);
      await reload();
      return outcome;
    }
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
    account, token, ready, configured: backend !== 'none', bookmark,
    register, signIn, signOut, deleteAccount, sync,
  }), [account, token, ready, backend, bookmark,
       register, signIn, signOut, deleteAccount, sync]);

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountContextValue {
  const value = useContext(AccountContext);
  if (!value) throw new Error('useAccount must be used inside AccountProvider');
  return value;
}

export { BOOKMARK_KEY };
