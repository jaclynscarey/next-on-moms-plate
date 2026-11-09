# Next on Mom's Plate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved invite-only family print request app with an authenticated review workflow and fair queue.

**Architecture:** Next.js App Router handles the interface and authenticated mutations. Supabase enforces membership and permissions in PostgreSQL and private image storage. A transactional outbox records email work alongside order changes; Resend sends notifications with retry protection.

**Tech Stack:** TypeScript, Next.js, React, Supabase, Resend, Vitest, Playwright.

**Spec:** ../specs/2026-11-08-next-on-moms-plate-design.md

## Global Constraints

- One MakerWorld model per order.
- Jacky is the only administrator.
- Approved orders are sorted by immutable original submission time.
- No remaining-weight tracking.
- Secrets, real family email addresses, and real order data do not belong in the public repository.
- Public signup is disabled.
- Target free plans; paid upgrades are optional.
- No em dashes in user-facing copy.

## Review Focus

- An edit racing with approval or printing must not bypass approval or alter a printing order.
- Nonmembers and ordinary members must not access private attachments or admin operations.
- Invalid or misleading MakerWorld URLs must not pass host validation.
- An email provider failure must not lose the order or duplicate its state transition.
- A reordered print using unavailable filament must require a fresh selection or explicit special request.

## File map

- `src/lib/orders.ts`: request types, validation, state transitions, queue sorting.
- `src/lib/orders.test.ts`: workflow and validation tests.
- `supabase/migrations/001_initial.sql`: schema, policies, transactional mutation functions, notification outbox.
- `supabase/tests/authorization.sql`: role, ownership, invitation, and race-sensitive mutation assertions.
- `src/lib/supabase/{server,client}.ts`: provider clients.
- `src/lib/auth.ts`, `src/app/auth/*`: membership checks, login, invitation acceptance, recovery.
- `src/app/actions/{orders,filaments,invitations,comments}.ts`: validated server mutations.
- `src/app/(dashboard)/*`: queue, request form, order detail, history, library, admin screens.
- `src/components/*`: navigation, order cards, parts picker, attachment input, status controls.
- `src/lib/notifications.ts`, `src/app/api/notifications/route.ts`: authenticated outbox delivery.
- `tests/e2e/workflow.spec.ts`: member and admin acceptance flow.
- `.env.example`, `README.md`: safe configuration and deployment instructions.

### Task 1: Establish and test the order workflow

**Interfaces:** `validateRequest(input: unknown): PrintRequestInput`; `getReadyQueue(orders: PrintOrder[]): PrintOrder[]`; `transitionOrder(order: PrintOrder, action: OrderAction, actor: Actor): PrintOrder`. Types defined in `src/lib/orders.ts`; timestamps remain immutable through edits and retries.

- [ ] Scaffold Next.js/TypeScript and Vitest, add environment exclusions and scripts; select compatible stable package versions using official documentation.
- [ ] Write failing tests in `src/lib/orders.test.ts`: queue skips holds and pending requests, sorts by submitted timestamp with ID tie break, preserves timestamp after reapproval, rejects nonadmin approvals, prevents edits/cancellation after printing, requires a new order for model replacement, and validates positive integer quantities and at least one named part.
- [ ] Include URL tests for real makerworld.com HTTPS model paths, lookalike domains, embedded credentials, non-HTTPS protocols, and malformed values. Reorders must receive fresh timestamps and flag unavailable selections.
- [ ] Run `npm test -- src/lib/orders.test.ts`; confirm behavior tests fail before implementation.
- [ ] Implement the typed domain module, then run tests and `npm run typecheck`; commit the passing unit.

### Task 2: Secure persistent data and accounts

**Interfaces:** Tables `profiles`, `invitations`, `recipients`, `filaments`, `orders`, `order_parts`, `order_comments`, `order_images`, `order_events`, `notification_outbox`. `requireMember(): Promise<Member>` and `requireAdmin(): Promise<Member>` validate server-side identity. `mutate_order(order_id, expected_version, action, payload)` atomically validates permission, version, state, and queues notification events.

- [ ] Write failing SQL assertions for nonmember reads, member approvals, another member's edits, unauthenticated storage access, public self-registration, invitation email mismatch, and stale expected versions.
- [ ] Create the migration and RLS/storage policies. Keep admin assignment out of client-writable metadata. Bootstrap the single admin through a documented operator-only step using deployment configuration.
- [ ] Implement cookie-based Supabase authentication, login/logout, invitation acceptance, and recovery. Server-generated invitations use the configured app origin; redirects must remain on that origin.
- [ ] Implement order/filament/invitation/comment actions with domain validation, transactional RPCs, and expected-version checks. Never expose service keys to the browser. Validate image MIME, actual content, count, and size; default to five JPEG/PNG/WebP images of at most 5 MB each.
- [ ] Run SQL assertions against local Supabase and repeat domain tests. Verify ordinary members cannot grant themselves admin. Document provider-dependent checks as blocked if services are unavailable; commit.

### Task 3: Build the family dashboard and admin experience

**Interfaces:** Dashboard components consume typed database records; forms call Task 2 actions. `RequestForm` accepts optional reorder source and submits one model with repeatable named parts and free-text personalization. Queue uses `getReadyQueue` from Task 1.

- [ ] Add acceptance tests for requesting on behalf of another recipient, multiple part/filament choices, optional references, edit/reapproval, cancel, hold/release, printing lock, completion, comments, and Request again with unavailable filament.
- [ ] Build the approved responsive shell and screens: Family Queue, New Request, Order Detail, Print History, Filament Library, Admin Review, invitation management. Include explicit loading, empty, validation, and failure states.
- [ ] Provide clearly labeled in-memory demo data when provider configuration is absent. Keep demo controls local; never claim a demo submission sent email or reached the live database.
- [ ] Run `npm run build`, type checks, and browser tests at desktop and 390px widths. Check keyboard access, readable labels, status text, and no horizontal overflow; commit.

### Task 4: Deliver email and deployment setup

**Interfaces:** `deliverNotifications(limit: number): Promise<DeliverySummary>` claims pending outbox jobs, uses stable event-based idempotency keys, and records delivery outcomes. The route requires an operator secret; state changes remain committed if delivery fails.

- [ ] Write failing notification tests for recipient selection, authenticated order links, duplicate delivery, provider timeout, and retryable errors. Never include access tokens or sensitive notes in email URLs.
- [ ] Implement Resend templates and outbox processing for submission/resubmission, approval, denial, requested changes, and completion. Add comments only if enabled by the admin default setting. Trigger immediate delivery after mutation and offer an admin retry for failed jobs, avoiding a dependency on a paid scheduler.
- [ ] Add `.env.example` with placeholders only and README instructions for Vercel, Supabase migrations/auth redirects, private storage, Resend sender verification, and the prints subdomain. Keep actual recipient addresses in configuration/database.
- [ ] Run all unit tests, type checks, production build, SQL authorization tests, and end-to-end flow where configuration permits. Review the diff for committed secrets and placeholder behavior.
- [ ] Push the reviewed branch when GitHub connectivity is available. Deployment and live email verification require configured provider accounts; report precisely which checks were run and which remain blocked.

## Execution

Implement inline in this session, preserving the approved scope. No application code or deployments exist yet. This plan and its defaults are ready for review before implementation.
