/**
 * Accounts, through Firebase.
 *
 * The app had an account system already, against `packages/server`. It still
 * does, and it is the better design — but `EXPO_PUBLIC_API_URL` has no default
 * and nothing is deployed, so in practice it could never sign anybody in. This
 * is the one that works today, against a project that already exists and that
 * the web prototype already writes to.
 *
 * Everything is loaded on demand. The SDK is large and most sessions never
 * open the account panel, so nothing here is imported until someone does —
 * which keeps it out of the first screen a learner waits for.
 *
 * Progress stays local-first. The device database remains the truth the UI
 * reads; the cloud gets a copy. That is deliberate: a learner on a train must
 * be able to study, and a sync that has not happened yet must never be able to
 * empty the screen.
 */
import type { ItemProgress } from '@nemcina/core';
import { firebaseConfig, firebaseConfigured } from './firebaseConfig';

export interface FirebaseUser {
  readonly uid: string;
  readonly email: string | null;
}

interface Services {
  readonly auth: import('firebase/auth').Auth;
  readonly db: import('firebase/firestore').Firestore;
  readonly authSdk: typeof import('firebase/auth');
  readonly storeSdk: typeof import('firebase/firestore');
}

let servicesPromise: Promise<Services | null> | null = null;

async function services(): Promise<Services | null> {
  if (!firebaseConfigured()) return null;
  if (!servicesPromise) {
    servicesPromise = (async () => {
      const [appSdk, authSdk, storeSdk] = await Promise.all([
        import('firebase/app'),
        import('firebase/auth'),
        import('firebase/firestore'),
      ]);
      // getApps() first: Expo Router can evaluate a module twice in development
      // and initializeApp throws on the second call.
      const app = appSdk.getApps().length > 0
        ? appSdk.getApp()
        : appSdk.initializeApp(firebaseConfig);
      return {
        authSdk,
        storeSdk,
        auth: authSdk.getAuth(app),
        db: storeSdk.getFirestore(app),
      };
    })().catch((error) => {
      // A blocked network or a misconfigured project must not take the app
      // down: the learner keeps studying locally and the panel says why.
      servicesPromise = null;
      throw error;
    });
  }
  return servicesPromise;
}

const toUser = (user: { uid: string; email: string | null } | null): FirebaseUser | null =>
  user ? { uid: user.uid, email: user.email } : null;

/**
 * Firebase's own error codes are not sentences. These are, and they say what
 * to do next rather than what went wrong internally.
 */
export function readableAuthError(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'That address already has an account. Try signing in instead.';
    case 'auth/invalid-email':
      return 'That does not look like an email address.';
    case 'auth/weak-password':
      return 'Passwords need at least six characters.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'That email and password do not match an account.';
    case 'auth/network-request-failed':
      return 'No connection to the account service. Your work is saved on this device.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a minute and try again.';
    default:
      return error instanceof Error && error.message
        ? error.message
        : 'Could not reach the account service.';
  }
}

export async function watchUser(
  onChange: (user: FirebaseUser | null) => void,
): Promise<() => void> {
  const sdk = await services().catch(() => null);
  if (!sdk) {
    onChange(null);
    return () => {};
  }
  return sdk.authSdk.onAuthStateChanged(sdk.auth, (user) => onChange(toUser(user)));
}

export async function createAccount(email: string, password: string): Promise<FirebaseUser> {
  const sdk = await services();
  if (!sdk) throw new Error('Accounts are not configured in this build.');
  const credential = await sdk.authSdk.createUserWithEmailAndPassword(sdk.auth, email, password);
  return toUser(credential.user)!;
}

export async function signInWithPassword(email: string, password: string): Promise<FirebaseUser> {
  const sdk = await services();
  if (!sdk) throw new Error('Accounts are not configured in this build.');
  const credential = await sdk.authSdk.signInWithEmailAndPassword(sdk.auth, email, password);
  return toUser(credential.user)!;
}

export async function signOutOfFirebase(): Promise<void> {
  const sdk = await services().catch(() => null);
  if (!sdk) return;
  await sdk.authSdk.signOut(sdk.auth);
}

/** `users/{uid}/progress/{itemId}` — the shape the web prototype already uses. */
const progressPath = (uid: string) => `users/${uid}/progress`;

/**
 * Push every local record to the cloud.
 *
 * Batched rather than a write per word: a first sync of a few hundred items as
 * individual requests is slow and can be rate limited. 400 leaves room under
 * Firestore's 500-operation limit.
 */
export async function pushProgress(
  uid: string, records: readonly ItemProgress[],
): Promise<number> {
  const sdk = await services();
  if (!sdk) throw new Error('Accounts are not configured in this build.');
  const { writeBatch, doc, collection } = sdk.storeSdk;
  const target = collection(sdk.db, progressPath(uid));
  let written = 0;
  for (let start = 0; start < records.length; start += 400) {
    const slice = records.slice(start, start + 400);
    const batch = writeBatch(sdk.db);
    for (const record of slice) batch.set(doc(target, record.itemId), record);
    await batch.commit();
    written += slice.length;
  }
  return written;
}

/** Everything the cloud holds for this learner. */
export async function pullProgress(uid: string): Promise<readonly ItemProgress[]> {
  const sdk = await services();
  if (!sdk) throw new Error('Accounts are not configured in this build.');
  const { getDocs, collection } = sdk.storeSdk;
  const snapshot = await getDocs(collection(sdk.db, progressPath(uid)));
  return snapshot.docs.map((entry) => entry.data() as ItemProgress);
}
