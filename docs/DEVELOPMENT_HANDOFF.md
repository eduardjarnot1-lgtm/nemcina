# Development handoff

## Specification and starting point

The owner resumed implementation by Codex on 2026-09-15 while Claude is
unavailable. `MASTER_SPEC.md` preserves the complete original 48-section
attachment from the earlier development task. It is the product specification;
later owner decisions take precedence. It is not a claim that all 48 sections
are implemented.

Start from PR #16 (`feat/learning-core`, `90dd1b4`), not the older static app
on `main`. PR #7 also remains open and contains earlier approved documentation
and source-use boundaries. Neither PR was merged during this continuation.

## Verified in this continuation

- Content validator: 110,384 checks; 4,646 words; 121 grammar topics and 615
  exercises; zero errors and one existing `einwerfen` near-duplicate warning.
- Core tests before edits: passed.
- Added a failing regression test: concurrent initial writes through an async
  storage adapter lost one word after restart.
- Serialized each key-value store's operations, including initial reads,
  writes and clear. A rejected operation still reaches its caller but does
  not prevent subsequent operations.
- Core tests after edits: **300 passed, zero failed, zero skipped**.
- Added coverage for concurrent first writes and attempts, clear followed by
  new work, and continuing after a failed device write.

Commands from the repository root (using the desktop's bundled runtimes):

```text
python app/tools/validate_content.py
node --test --test-reporter=spec "packages/core/test/*.test.ts"
git diff --check
```

The system Python command on this Windows machine is a Store alias; use an
actual Python executable. Node and Python were available in the Codex runtime.
Server tests, TypeScript checks, browser checks and physical-device checks
were not rerun in this continuation. Earlier results in PROJECT_STATUS.md
belong to the original PR author.

The storage queue coordinates one store instance. It does not add transactions
across progress and attempt records, coordinate multiple instances, or change
the existing handling of failed writes and corrupt data.

## Next priorities against the specification

1. Sections 31, 35, 36: independently run server/type/browser checks and audit
   account changes, sign-out, sync conflicts and storage failures. Resolve
   errors before adding further product features.
2. Sections 8, 9, 15, 25: audit statistics against the bounded attempt log.
   Lifetime XP and streak claims must survive more than 500 attempts.
3. Sections 10, 11: reconcile the original OpenAI requirement with the current
   Anthropic-only coach provider. Build provider configuration and test offline
   fallback before any paid request; no real API call was made in this pass.
4. Sections 18, 19, 30: finish account lifecycle and sync resilience; hosting,
   OAuth credentials and mail delivery remain external setup.
5. Sections 16, 21–29: check the real mobile experience, guide character,
   navigation, accessibility, daily goals and missing learning modes.
6. Sections 12–14, 32–34, 38: retain modular entitlement/ads/analytics boundaries;
   commercial release remains dependent on source rights and owner-provided
   business/store configuration.

This is a prioritized continuation plan, not a completed compliance audit of
every requirement. Preserve working features and add focused tests with fixes.
