/**
 * Optional Firebase account and cloud-sync adapter.
 *
 * The app remains local-first: db.js is still the immediate source of truth
 * for the UI, and Firestore receives a copy after a local write. Every cloud
 * document is scoped beneath the authenticated user's UID.
 */
import { firebaseConfig } from './firebase-config.js';
import { COLLECTIONS, all, onChange, applyRemoteRecord, bindCloudUser } from './db.js';

const VERSION = '11.0.2';
const firebaseUrl = (module) => `https://www.gstatic.com/firebasejs/${VERSION}/firebase-${module}.js`;
let servicesPromise = null;
let stopListeners = [];
let stopLocalSync = null;
let activeUid = null;
let applyingRemote = false;
let syncQueue = Promise.resolve();

export const firebaseConfigured = () => Boolean(firebaseConfig?.apiKey && firebaseConfig?.projectId);

async function services() {
  if (!firebaseConfigured()) return null;
  if (!servicesPromise) {
    servicesPromise = Promise.all([
      import(firebaseUrl('app')),
      import(firebaseUrl('auth')),
      import(firebaseUrl('firestore')),
    ]).then(([appSdk, authSdk, storeSdk]) => {
      const app = appSdk.initializeApp(firebaseConfig);
      return { authSdk, storeSdk, auth: authSdk.getAuth(app), db: storeSdk.getFirestore(app) };
    });
  }
  return servicesPromise;
}

export async function watchAuthentication(callback) {
  const sdk = await services();
  if (!sdk) return () => {};
  return sdk.authSdk.onAuthStateChanged(sdk.auth, callback);
}

export async function signUp(email, password) {
  const sdk = await services();
  return sdk.authSdk.createUserWithEmailAndPassword(sdk.auth, email, password);
}

export async function signIn(email, password) {
  const sdk = await services();
  return sdk.authSdk.signInWithEmailAndPassword(sdk.auth, email, password);
}

export async function signInWithGoogle() {
  const sdk = await services();
  return sdk.authSdk.signInWithPopup(sdk.auth, new sdk.authSdk.GoogleAuthProvider());
}

export async function signOut() {
  const sdk = await services();
  return sdk.authSdk.signOut(sdk.auth);
}

const remoteCollection = (sdk, uid, name) => sdk.storeSdk.collection(sdk.db, 'users', uid, name);

async function writeCollection(sdk, uid, name) {
  const batch = sdk.storeSdk.writeBatch(sdk.db);
  for (const record of all(name)) {
    const id = name === 'profile' ? 'profile' : record.id || record.vocabularyItemId || record.grammarTopicId;
    if (!id) continue;
    batch.set(sdk.storeSdk.doc(remoteCollection(sdk, uid, name), id), record, { merge: true });
  }
  await batch.commit();
}

async function clearRemoteCollection(sdk, uid, name) {
  const snapshot = await sdk.storeSdk.getDocs(remoteCollection(sdk, uid, name));
  if (snapshot.empty) return;
  const batch = sdk.storeSdk.writeBatch(sdk.db);
  snapshot.forEach((entry) => batch.delete(entry.ref));
  await batch.commit();
}

async function mergeCollection(sdk, uid, name) {
  const snapshot = await sdk.storeSdk.getDocs(remoteCollection(sdk, uid, name));
  applyingRemote = true;
  try {
    snapshot.forEach((entry) => applyRemoteRecord(name, name === 'profile' ? 'me' : entry.id, entry.data()));
  } finally {
    applyingRemote = false;
  }
  await writeCollection(sdk, uid, name);
}

/** Begin bidirectional sync after Firebase Authentication has supplied a UID. */
export async function startCloudSync(user) {
  if (!user?.uid || activeUid === user.uid) return;
  await stopCloudSync();
  const sdk = await services();
  if (!sdk) return;
  activeUid = user.uid;
  bindCloudUser(user);

  for (const name of COLLECTIONS) await mergeCollection(sdk, user.uid, name);

  stopLocalSync = onChange((name, change) => {
    if (applyingRemote || !activeUid) return;
    // Queue writes so a full local reset clears each remote collection before
    // the fresh default profile is written back.
    syncQueue = syncQueue
      .then(() => change?.type === 'clear'
        ? clearRemoteCollection(sdk, activeUid, name)
        : writeCollection(sdk, activeUid, name))
      .catch((error) => console.warn('Cloud sync failed:', error));
  });

  for (const name of COLLECTIONS) {
    stopListeners.push(sdk.storeSdk.onSnapshot(remoteCollection(sdk, user.uid, name), (snapshot) => {
      applyingRemote = true;
      try {
        snapshot.docChanges().forEach((change) => {
          if (change.type !== 'removed') applyRemoteRecord(name, change.doc.id, change.doc.data());
        });
      } finally {
        applyingRemote = false;
      }
    }));
  }
}

export async function stopCloudSync() {
  if (stopLocalSync) stopLocalSync();
  stopLocalSync = null;
  stopListeners.forEach((stop) => stop());
  stopListeners = [];
  activeUid = null;
  syncQueue = Promise.resolve();
}
