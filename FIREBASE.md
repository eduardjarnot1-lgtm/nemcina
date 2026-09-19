# Firebase

The project is **master-german**. Two clients talk to it: the web prototype in
`app/` and the mobile app in `apps/mobile`. Both write to the same place, so a
learner who signs in on one sees their work on the other.

## The rules are not deployed by committing them

`firestore.rules` in this repository is a **file**, not a policy. Until it is
pushed, Firestore enforces whatever the console currently holds — and a
database created "in test mode" is open to anyone for thirty days and then
denies everything.

```bash
npm install -g firebase-tools     # once
firebase login                    # once
firebase deploy --only firestore:rules
```

`firebase.json` and `.firebaserc` exist so that command works with no
arguments and always targets the right project.

**Check this in the console before anyone real uses the app.** Firestore →
Rules should match `firestore.rules`: a learner may read and write only
`users/{their own uid}`. If it instead says `allow read, write: if
request.time < timestamp.date(...)`, the database is in test mode and is
currently world-writable.

## The API key in the client is not a secret

`app/src/firebase-config.js` and `apps/mobile/src/firebaseConfig.ts` both carry
the browser configuration, including `apiKey`. That is how Firebase is designed:
the key identifies the project, it does not authorise anything. Access is
enforced by Authentication plus the rules above. Hiding it would protect
nothing and break the client.

What must **never** be committed is a service-account JSON or an admin SDK
credential. Those do bypass the rules. There are none in this repository.

## What is enabled

Email and password, and Google. Both are on in the console; email/password is
what the two clients offer first.
