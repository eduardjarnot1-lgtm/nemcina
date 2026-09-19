/**
 * Firebase's browser configuration for the mobile app.
 *
 * The same project the web prototype uses (`app/src/firebase-config.js`), on
 * purpose: one learner, one account, whichever client they opened.
 *
 * This is not an administrative credential. The key identifies the project; it
 * authorises nothing. Access is enforced by Firebase Authentication and the
 * Firestore rules in `firestore.rules` — see FIREBASE.md, which also explains
 * why those rules do nothing until they are deployed.
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyA_z3rVna6MT2JYovXPNMpsskdqU-grhBA',
  authDomain: 'master-german.firebaseapp.com',
  projectId: 'master-german',
  storageBucket: 'master-german.firebasestorage.app',
  messagingSenderId: '1087746274377',
  appId: '1:1087746274377:web:0da6bd2a3fa10f1c72bb98',
} as const;

export const firebaseConfigured = (): boolean =>
  Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
