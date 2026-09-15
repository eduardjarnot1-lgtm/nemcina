# @nemcina/server

Accounts and progress sync. This package exists to hold the things a phone must
not be trusted with: who someone is, how long they stay signed in, and whether
they have paid.

It does **not** schedule anything. Which word comes next is the client's engine
(`@nemcina/core`); duplicating it here would give two implementations to keep in
step, and the server has no reason to know.

## Running it

```bash
cp packages/server/.env.example packages/server/.env   # then fill in TOKEN_PEPPER
npm start -w @nemcina/server
```

In production the server **refuses to start** without `TOKEN_PEPPER` rather than
falling back to a default. In development it generates an ephemeral one, so a
contributor needs no credentials and every restart invalidates every session —
which is what a development secret should do.

## Endpoints

| | |
|---|---|
| `GET /health` | No credentials. |
| `POST /accounts` | Register. Returns a session. |
| `POST /sessions` | Sign in. |
| `DELETE /sessions` | Sign out this device. |
| `DELETE /sessions/all` | Sign out everywhere — what a stolen phone needs. |
| `GET /me` | The account and its entitlement, as a server fact. |
| `DELETE /me` | Erase the account, its sessions and its progress. |
| `POST /progress/sync` | Merge this device's records in, return what it is behind on. |
| `DELETE /progress` | Clear progress, keep the account. |

## Decisions

**Opaque tokens, not JWTs.** A JWT buys stateless verification and costs the
ability to revoke. "Sign me out everywhere" after a stolen phone is not worth
trading for one database read. What is stored is the token's HMAC, so a stolen
database contains no usable tokens.

**scrypt for passwords**, from `node:crypto`, at the OWASP parameters
(N=2¹⁵, r=8, p=1). The stored string carries its own parameters, so raising the
cost later does not invalidate anyone's password.

**Length is the only password rule.** Character-class requirements push people
towards `Password1!` and towards reuse.

**A wrong password and an unknown address answer identically**, in the same
time — an unknown address is checked against a decoy hash so the timing does not
say which addresses are registered. Registering an address already in use gives
the same kind of refusal, for the same reason.

**The client never asserts an entitlement.** `tier` and `premiumUntil` are set
server-side and reported to the client as facts. A sync payload claiming
`premium: true` changes nothing (§31).

**A client may only write its own rows.** The `userId` in an incoming record is
overwritten with the authenticated account's, whatever the payload says.

**Rows are stamped with the server's clock.** A device with a wrong clock would
otherwise be able to make its rows permanently newest, or permanently invisible.

**The merge rule lives in `@nemcina/core`**, not here, so the client and the
server cannot disagree about who wins. The rule is: the later review wins,
because a spaced-repetition record only changes when the item is reviewed.

**No framework.** Eight routes and `node:http`. A router dependency would be
more code to audit than the code it replaces, and this server's whole point is
that it holds credentials and can be read end to end. Zero runtime dependencies.

## Known limitations

- **`node:sqlite` is an experimental Node API.** Stated rather than hidden.
  **Postgres is the production answer**, and every query lives in `db.ts` and
  `progress.ts` so that swapping it is two files rather than a rewrite.
- **No email verification and no password reset.** Both need a mail provider,
  which is a decision and a credential nobody has made or supplied yet.
- **No TLS here.** This is meant to sit behind a terminating proxy. It binds to
  `127.0.0.1`.
- **Rate limiting is per account, not per IP**, and lives in the database. It
  stops password guessing against one account; it does not stop a botnet.
- **Conflicting offline reviews lose the earlier one.** Replaying the attempt
  log through the scheduler would keep both; that needs the full log on both
  sides and is not built. The case requires two offline devices and the same
  word.
- **Nothing is deployed.** There is no hosting, no domain and no TLS
  certificate, so the mobile app still talks to no server by default.

## Tests

```bash
npm test -w @nemcina/server          # 60 tests
```

`test/roundtrip.test.ts` is the one worth reading: two devices, the client's own
store and sync, the real server over a real socket. Study on the train, sign in
on the tablet, find the work there.
