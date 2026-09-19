/**
 * Accounts, through Firebase.
 *
 * The app had an account system already, against `packages/server`. It still
 * does, and it is the better design — but `EXPO_PUBLIC_API_URL` has no default
 * and nothing is deployed, so in practice it could never sign anybody in. This
 * is the one that works today, against a project that already exists and that
 * the web prototype already writes to.
 *
 * The SDK is imported statically, which was not the first choice. It was
 * loaded on demand at first, so a learner who never signs in would not pay for
 * it — but the account context asks who is signed in as soon as the app
 * mounts, so the download happened on the first screen anyway. Measured in a
 * browser: every chunk was fetched before any interaction. What the dynamic
 * import did buy was a split bundle, whose chunk map Metro resolves against
 * the page URL, which the host assigns. A deferral that never deferred is not
 * worth that.
 *
 * Progress stays local-first. The device database remains the truth the UI
 * reads; the cloud gets a copy. That is deliberate: a learner on a train must
 * be able to study, and a sync that has not happened yet must never be able to
 * empty the screen.
 */
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';

import type { ItemProgress } from '@nemcina/core';
import { firebaseConfig, firebaseConfigured } from './firebaseConfig';

interface Services {
  readonly auth: Auth;
  readonly db: Firestore;
}

export interface FirebaseUser {
  readonly uid: string;
  readonly email: string | null;
}

function services(): Services | null {
  if (!firebaseConfigured()) return null;
  // getApps() first: Expo Router can evaluate a module twice in development
  // and initializeApp throws on the second call.
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  return { auth: getAuth(app), db: getFirestore(app) };
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
  let sdk: Services | null = null;
  // A misconfigured project must not take the app down: the learner keeps
  // studying locally and the panel says why.
  try { sdk = services(); } catch { sdk = null; }
  if (!sdk) {
    onChange(null);
    return () => {};
  }
  return onAuthStateChanged(sdk.auth, (user) => onChange(toUser(user)));
}

/** Throws rather than returning null: every caller has a panel to show it in. */
function required(): Services {
  const sdk = services();
  if (!sdk) throw new Error('Accounts are not configured in this build.');
  return sdk;
}

export async function createAccount(email: string, password: string): Promise<FirebaseUser> {
  const { auth } = required();
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  return toUser(credential.user)!;
}

export async function signInWithPassword(email: string, password: string): Promise<FirebaseUser> {
  const { auth } = required();
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return toUser(credential.user)!;
}

export async function signOutOfFirebase(): Promise<void> {
  let sdk: Services | null = null;
  try { sdk = services(); } catch { sdk = null; }
  if (!sdk) return;
  await signOut(sdk.auth);
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
  const { db } = required();
  const target = collection(db, progressPath(uid));
  let written = 0;
  for (let start = 0; start < records.length; start += 400) {
    const slice = records.slice(start, start + 400);
    const batch = writeBatch(db);
    for (const record of slice) batch.set(doc(target, record.itemId), record);
    await batch.commit();
    written += slice.length;
  }
  return written;
}

/** Everything the cloud holds for this learner. */
export async function pullProgress(uid: string): Promise<readonly ItemProgress[]> {
  const { db } = required();
  const snapshot = await getDocs(collection(db, progressPath(uid)));
  return snapshot.docs.map((entry) => entry.data() as ItemProgress);
}
