# Phase 2 — Secret store design

Scope: design (not implementation) for the secret-storage layer that
Phase 2 of the integration-honesty plan
(`/home/user/.claude/plans/no-implement-all-the-compressed-piglet.md`)
needs before `connected_integrations` can land.

Status: design only. No code changes, no schema migration, no new deps.

---

## 1. Does an existing key-value secret store exist?

**No.** Searched the codebase for prior art and found none:

- `rg -i "secret.?store|kv|vault|encrypt|decrypt|aes-gcm"` against
  `packages/astropress/src/**` returns only:
  - `packages/astropress/src/crypto-primitives.ts` — Argon2id password
    hashing, KMAC-256 opaque-token digests, ML-DSA-65 signatures.
    **No symmetric encryption primitives.**
  - `packages/astropress/src/sqlite-runtime/webhooks.ts` —
    HMAC signing for outbound webhooks; no at-rest encryption.
  - `tooling/scripts/audit-crypto.ts` — gate ensuring only approved
    primitives are used.
- `packages/astropress/src/sqlite-schema.sql` has no `kv`, `secrets`,
  `vault`, or equivalent table.
- `runtime-env.ts` and `runtime-admin-auth.ts` use `rootSecret` only
  for KMAC-keyed token hashing (one-way, not reversible).

There is therefore nothing to reuse. We must introduce the layer.

What we *can* lean on:

- `getAstropressRootSecretCandidates()` in
  `packages/astropress/src/runtime-env.ts:185` already returns
  `[current, previous]` from `ASTROPRESS_ROOT_SECRET` and
  `ASTROPRESS_ROOT_SECRET_PREV` (with `SESSION_SECRET[_PREV]`
  fallbacks). The two-key window for rotation is already a project
  convention — Phase 2 inherits it instead of inventing a new env var.
- `@noble/hashes` v2 (already a runtime dep at
  `packages/astropress/package.json`) ships HKDF-SHA-256.
- `crypto.subtle` (WebCrypto) provides AES-GCM on both Bun (self-host
  sqlite) and Cloudflare Workers (D1). No new dep.

---

## 2. Minimal symmetric-encryption design

### 2.1 Constraints recap

- KEK material: `rootSecret` (current) and `rootSecretPrevious`
  (rotation window). No new env var.
- Runtimes: Bun + better-sqlite3 (self-host) and Cloudflare Workers +
  D1 (hosted). Both expose `globalThis.crypto.subtle` and
  `crypto.getRandomValues`.
- Primitives: WebCrypto AES-GCM for the data-encryption step;
  `@noble/hashes/hkdf` (SHA-256) for KEK derivation. No new deps.
- No change to `crypto-primitives.ts` purpose-keyed conventions —
  add a new module rather than overload.

### 2.2 Envelope shape

Envelope encryption with a per-secret random data-encryption key
(DEK). The DEK is wrapped by a deterministically-derived
key-encryption key (KEK).

```
record  = { dek_wrap, ciphertext }
dek     = random 32 bytes                       (per secret)
kek     = HKDF-SHA-256(
            ikm        = rootSecret,
            salt       = wrap_salt (16 random bytes, stored),
            info       = "astropress:integration-secret-kek:v1",
            length     = 32,
          )
dek_wrap     = AES-GCM(key = kek, iv = wrap_iv (12 random bytes),
                       plaintext = dek,
                       aad = "astropress:dek-wrap:v1|" || domain || "|" || provider)
ciphertext   = AES-GCM(key = dek, iv = data_iv (12 random bytes),
                       plaintext = JSON.stringify(secretFields),
                       aad = "astropress:integration-secret:v1|" || domain || "|" || provider)
```

Stored fields (all base64-url, no padding):
`v` (envelope version, currently `1`), `kid` (key id — see rotation),
`wrap_salt`, `wrap_iv`, `dek_wrap`, `data_iv`, `ciphertext`.

The AADs bind every record to (envelope-version, domain, provider) so
a row swapped between providers fails to decrypt — defence in depth
against accidental cross-binding bugs.

### 2.3 Why envelope (vs. encrypt-with-KEK directly)

- One-shot rotation: rotating `rootSecret` only requires re-wrapping
  the (small) DEK, never re-encrypting potentially-large config
  blobs. Keeps the rotation script bounded and idempotent.
- Future-proofs an HSM/KMS backend: only the wrap step needs to
  delegate to KMS later; the data layer is unchanged.
- Per-secret DEKs limit the blast radius of a single nonce reuse bug
  to one record.

### 2.4 Why AES-GCM via WebCrypto (vs. `@noble/ciphers`)

- Available natively on both target runtimes (Bun and Workers); no
  new dep, no WASM cost, smaller worker bundle.
- `@noble/ciphers` is **not** currently a dep. The constraint says
  reuse only what is already in the tree.
- `@noble/hashes/hkdf` *is* in the tree (v2.2 ships HKDF) and is the
  right tool for KEK derivation since WebCrypto's `deriveKey` would
  need an importable raw key anyway.

### 2.5 Module shape (proposal, not implementation)

`packages/astropress/src/integration-secret-envelope.ts`:

```ts
export interface SealedSecret {
  v: 1;
  kid: "current" | "previous";  // see §2.6
  wrap_salt: string;            // base64url
  wrap_iv: string;
  dek_wrap: string;
  data_iv: string;
  ciphertext: string;
}

export interface SecretContext {
  domain: string;
  provider: string;
}

export async function sealIntegrationSecret(
  plaintextFields: Record<string, string>,
  ctx: SecretContext,
  rootSecret: string,
): Promise<SealedSecret>;

export async function openIntegrationSecret(
  sealed: SealedSecret,
  ctx: SecretContext,
  rootSecrets: { current: string; previous?: string },
): Promise<{ fields: Record<string, string>; usedKid: "current" | "previous" }>;
```

`openIntegrationSecret` tries the kid named in the envelope first;
on `OperationError` falls back to the other slot if available. Returns
which kid actually succeeded so the repository can opportunistically
re-seal under `current` after a successful `previous` decrypt.

### 2.6 Rotation story

Two-phase, zero-downtime, no provider re-onboarding required.

| Step | Operator action | What happens |
|---|---|---|
| 1 | Set `ASTROPRESS_ROOT_SECRET_PREV` = old, `ASTROPRESS_ROOT_SECRET` = new. Deploy. | New writes seal under `kid="current"` (= new). Reads decrypt with current; on failure fall through to previous. Operator-visible behaviour: nothing breaks. |
| 2 | Run `bun run tooling/scripts/rotate-integration-secrets.ts`. | Reads every row whose `kid="previous"` (or whose decrypt only succeeds against previous), unseals, re-seals under current, writes back. Idempotent — re-running is a no-op once all rows are `kid="current"`. |
| 3 | Confirm the script reports `0 rows remaining on previous`. Unset `ASTROPRESS_ROOT_SECRET_PREV`. Deploy. | Previous-key trust is removed. |

Properties:

- An operator who only does step 1 still has a working system
  indefinitely (until they remove `_PREV`); the rotate script just
  amortises the work.
- The script must be safe under concurrent admin writes: per-row
  `UPDATE ... WHERE kid='previous' AND ciphertext = :original` so a
  concurrent reseal by a request handler doesn't get clobbered.
- D1: same script, same SQL — D1's adapter already mirrors the
  sqlite repository pattern.
- Disaster case (operator lost the previous key before rotating):
  there is no recovery — the integration must be reconnected from
  the UI. This is the same property as `SESSION_SECRET` rotation
  today and is acceptable for API-key-grade material.

### 2.7 What is **not** in scope here

- Per-tenant KEKs. Astropress is single-tenant per deploy.
- HSM/KMS delegation. The envelope shape leaves room; deferred.
- Rekey of the DEK itself (only the wrap is rotated). Re-issuing
  DEKs requires re-encrypting `ciphertext`; not justified until
  there's a known DEK-compromise vector.
- OAuth refresh tokens. Phase 4 is API-key-only per the parent plan.

---

## 3. Schema sketch

Two tables, joined by `(domain, provider)`. Splitting keeps the
`connected_integrations` row cheap to read for the sidebar
status-badge query (Phase 2c) without ever touching ciphertext.

```sql
-- Existing pattern: append to packages/astropress/src/sqlite-schema.sql
-- and mirror in the D1 adapter.

CREATE TABLE IF NOT EXISTS connected_integrations (
  domain        TEXT NOT NULL,
  provider      TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'connected'
                CHECK (status IN ('connected','error','paused')),
  config_json   TEXT NOT NULL,         -- non-secret provider config
  connected_at  TEXT NOT NULL,         -- ISO 8601 UTC
  last_check_at TEXT,
  last_error    TEXT,                  -- typed error code, never raw API body
  PRIMARY KEY (domain, provider)
);

CREATE INDEX IF NOT EXISTS idx_connected_integrations_status
  ON connected_integrations (status);

CREATE TABLE IF NOT EXISTS integration_secrets (
  domain         TEXT NOT NULL,
  provider       TEXT NOT NULL,
  envelope_v     INTEGER NOT NULL,     -- envelope schema version (1)
  kid            TEXT NOT NULL         -- 'current' | 'previous'
                 CHECK (kid IN ('current','previous')),
  wrap_salt      TEXT NOT NULL,        -- base64url
  wrap_iv        TEXT NOT NULL,
  dek_wrap       TEXT NOT NULL,
  data_iv        TEXT NOT NULL,
  ciphertext     TEXT NOT NULL,
  rotated_at     TEXT NOT NULL,        -- updated on every reseal
  PRIMARY KEY (domain, provider),
  FOREIGN KEY (domain, provider)
    REFERENCES connected_integrations (domain, provider)
    ON DELETE CASCADE
);
```

Why two tables:

- **Status reads** (sidebar badges, dashboards) never SELECT secrets.
  The repository layer can expose a `findStatus(domain)` method that
  doesn't even import the envelope module. Reduces accidental-leak
  surface.
- **Disconnect** is `DELETE FROM connected_integrations WHERE …` —
  the cascade removes the secret in the same transaction. No
  ordering bug where the public row vanishes but the ciphertext
  lingers.
- **Backups / sqlite dumps** that are accidentally shared still
  contain the ciphertext, but ciphertext without `rootSecret` is
  inert. The audit (§4) verifies that.

Repository factory: `createIntegrationsRepository()` matching the
existing `createAstropressAuthRepository` shape
(`packages/astropress/src/sqlite-runtime/auth.ts`). Two methods that
return secrets — `findSecret` and `upsertSecret` — take an explicit
`rootSecrets` argument; status methods (`findStatus`, `listStatuses`,
`updateStatus`) do not, so they cannot accidentally surface plaintext.

---

## 4. Audit + test surface

The whole point of writing this down is so the proof obligations
exist before code does. Each item below is a concrete artefact that
must land *with* the Phase 2 implementation PR.

### 4.1 New audit script: `audit:integration-secrets`

`tooling/scripts/audit-integration-secrets.ts`. Wired into pre-push
+ CI alongside the existing audit suite. Static checks:

1. **No raw secret column reads outside the envelope module.**
   AST-grep: any SELECT/access touching `integration_secrets.ciphertext`
   or `dek_wrap` outside `integration-secret-envelope.ts` and
   `integrations-repository.ts` fails the audit.
2. **No plaintext secret in error paths.** Grep for the strings
   `apiKey`, `secret`, `token`, `password` appearing as values inside
   `console.*`, `logger.*`, `throw new Error(`…`${`…, or
   `Response.json({...})` in any file that imports the integrations
   repository. The fix pattern is to throw a typed error code
   (`INTEGRATION_VERIFY_FAILED` etc.) and surface only the code.
3. **Last-error sanitisation.** Any write to
   `connected_integrations.last_error` must go through a single
   `sanitizeIntegrationError(err)` helper; direct writes fail.
4. **Envelope module purity.** `integration-secret-envelope.ts` may
   not import any logger, fetch, or DB module — pure crypto.
5. **Snapshot of the envelope JSON shape.** A fixture round-trip
   test asserts that a sealed value's JSON keys are exactly
   `{v, kid, wrap_salt, wrap_iv, dek_wrap, data_iv, ciphertext}` —
   regression guard against accidentally appending a "debug" field
   (e.g. plaintext provider) that ships to disk.

### 4.2 Unit tests

`packages/astropress/tests/integration-secret-envelope.test.ts`:

- Round-trip: seal → open returns identical fields.
- AAD binding: a row sealed with `(domain=newsletter, provider=mailchimp)`
  fails to open under `(provider=listmonk)` with a typed error.
- Tamper detection: flipping any byte of `ciphertext`, `dek_wrap`,
  `wrap_iv`, or `data_iv` causes `open` to throw.
- Wrong-key behaviour: opening with a `rootSecret` that matches
  neither `current` nor `previous` throws; opening with only
  `previous` matching succeeds and reports `usedKid="previous"`.
- Determinism of nonces: two seals of the same plaintext produce
  different `wrap_iv`, `data_iv`, `wrap_salt`, and `ciphertext`.
- Output charset: every base64url field decodes and re-encodes
  byte-identically (no padding).

`packages/astropress/tests/integrations-repository.test.ts`:

- Status CRUD round-trip (no secrets involved).
- `findStatus` / `listStatuses` do not select from
  `integration_secrets` (assert via spy on the prepared-statement
  source string).
- `upsertSecret` followed by `findSecret` returns plaintext fields;
  same call with a wrong `rootSecret` throws.
- Disconnect cascades: deleting from `connected_integrations` leaves
  zero rows in `integration_secrets`.
- Concurrent-rotation guard: simulating two parallel reseals of the
  same row results in one update and one no-op, never a lost write.

### 4.3 Privacy invariants suite (extend existing)

`packages/astropress/tests/privacy-invariants.test.ts` already exists
(see §1 search). Add cases:

- Render a fully-populated `integration_secrets` row through the
  admin API response serialisers used by the Phase 2 UI; assert
  none of `ciphertext`, `dek_wrap`, `wrap_*`, `data_iv` appear in
  the JSON shape returned to the browser.
- Drive a forced verify-failure end-to-end and assert the
  `last_error` column and the typed API error both resolve to a
  short code (`INTEGRATION_VERIFY_FAILED`, `INTEGRATION_TIMEOUT`,
  …) with no echoed credential or upstream body fragment.

### 4.4 Sqlite-dump leak proof

`packages/astropress/tests/integration-secret-dump.test.ts`:

- Create a connection, seed an integration with a
  recognisable canary string (`"CANARY-Q4F7"` as the API key value).
- `vacuum into` a tempfile, then `fs.readFile` the bytes.
- Assert the canary substring is **not** present anywhere in the
  dump. (Ciphertext is fine; plaintext is the bug.)
- Repeat after a `disconnect` call — assert the canary still
  doesn't appear (no tombstone leak).

### 4.5 Log-leak proof

A test harness wraps the project logger, drives a happy-path
`connect` + a failing `verify`, and asserts no log line ever
contains the canary string. Reuses the canary-grep helper from
§4.4 against captured log buffers.

### 4.6 Mutation gate scope

Add `integration-secret-envelope.ts` and
`integrations-repository.ts` to the mutation-test scope so the
crypto helpers are mutation-tested at the project's standard
threshold. Reseal-on-read in the repository must specifically be
mutation-covered (a mutant that skips reseal must be killed by the
rotation test in §4.2).

---

## 5. Open questions to resolve before writing code

These are deliberately *not* answered here; flagging them so the
implementation PR doesn't surprise the reviewer:

1. **Telemetry on rotation lag.** Should the admin dashboard surface
   "N integrations still wrapped under previous key"? Probably yes,
   but the metric source has not been wired.
2. **Backup/restore UX.** Self-host operators who restore an old
   sqlite dump under a newer `rootSecret` will see all integrations
   fail to decrypt. The error code should specifically tell them to
   set `ASTROPRESS_ROOT_SECRET_PREV` to the dump-era secret. Copy
   needs writing.
3. **D1 column types.** D1 stores TEXT identically to sqlite, but
   the size budget for a base64url envelope on a single row should
   be sanity-checked against D1's row-size limit before Phase 2
   lands.
4. **Coverage exemption for the rotation script.** The catch-all
   error path in `rotate-integration-secrets.ts` likely needs the
   same v8 ignore pattern other Cloudflare D1 error-recovery paths
   use; flag at PR time.

---

## 6. Summary

- No existing secret store; design the layer.
- AES-GCM (WebCrypto) + HKDF-SHA-256 (`@noble/hashes`) envelope.
  No new deps, no new env var.
- KEK = HKDF(rootSecret); DEK = per-secret random; AAD binds
  `(envelope-version, domain, provider)`.
- Two tables, public/secret split, FK cascade on disconnect.
- Rotation: keep the existing `_PREV` window; add a one-shot
  rotate script. Lazy reseal on read covers the gap.
- Six test surfaces (envelope round-trip, repository, privacy
  invariants, sqlite-dump grep, log grep, mutation) plus a new
  `audit:integration-secrets` script enforce that secrets do not
  leak via logs, error messages, API responses, or DB dumps.
