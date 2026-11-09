# Implementation ledger

Plan: `docs/superpowers/plans/2026-11-08-next-on-moms-plate.md`

- Approved scope and visual direction recorded before implementation.
- Dedicated new repository with feature branch `feat/family-print-dashboard`; no existing application code to disturb.
- Ruling: Use the fresh repository's feature branch rather than a linked worktree because the checkout has no existing application or competing changes. Cost if wrong: less filesystem isolation.
- Preflight: Task 1 domain types feed server validation and UI; database RPCs enforce equivalent transition rules atomically; UI uses version checks from database records; notifications consume committed outbox events.
- Ruling: Store parts as a validated JSON array in orders instead of a separate table. It keeps the small application's edits atomic. Cost if wrong: more work for future part-level analytics.
- Ruling: Use PGlite for PostgreSQL/RLS regression tests because a local Supabase/Docker service is not configured. Cost if wrong: hosted Auth and Storage differences still require live smoke testing.
- Ruling: Comment email is deferred; comments are visible in the app. The user confirmed threads, and comment emails were only proposed. Cost if wrong: a commenter may need to prompt the other person to look.
- Task 1: queue/validation/transitions implemented; 24 tests passed after the initial missing-module failure.
- Task 2: auth, invitation, server actions, private references, transactional mutations, RLS implemented; seven embedded PostgreSQL authorization tests passed. Live provider verification remains pending.
- Task 3: responsive queue, requests, details, review, filaments, history, invitations and demo implemented. Four browser scenarios passed at 1440px and 390px after correcting an overly strict select locator.
- Task 4: email outbox and templates implemented; two template tests passed. Live delivery remains pending provider setup.
- The initial compiler failures were a missing closing brace and union narrowing; corrected and production build/typecheck passed.
- Independent final review requested before finalizing.

- Ruling: Reference uploads are capped at 3 MB total for up to five images to fit Vercel request limits. Cost if wrong: users must resize larger screenshots.
- Final review: independent review completed. Fixed null version bypass, FIFO/one-print enforcement, printing-order reentry, order-login deep links, cookie refresh, scoped reference/feedback reads, guarded staged attachment, unsafe SQL URL paths, and email backoff/reconciliation.
- Final verification: 45 automated tests and four browser tests passed; production build and typecheck passed. Live Auth/Storage/SMTP/email smoke tests await provider setup.
- Final: minor (deferred): optional filament photographs; the library uses color swatches.
- Final: minor (deferred): the UI queue sorts at millisecond resolution; PostgreSQL enforces authoritative microsecond ordering on Start.
