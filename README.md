# Next on Mom's Plate

An invite-only family 3D printing dashboard. Submit a MakerWorld model, choose filaments by part, add personalization, and send the request for review. Approved orders follow original submission time; held orders do not block ready prints.

Planned address: `prints.jaclyncarey.com`. The existing portfolio stays on GitHub Pages.

## Local development

Requires Node.js 22 or later (Node 24 LTS recommended).

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Without Supabase settings the app shows an explicitly labeled **in-memory demo**. Demo orders are examples; the filament library contains the 12 owned Insignia filaments with approximate color swatches; no mail is sent, images are not saved, and refresh resets changes. Demo controls simulate the admin account. Do not use demo mode to collect real requests.

For live mode copy `.env.example` to `.env.local` and configure your own values. Never commit `.env.local` or real family data. The service-role key and email keys are server-only.

## Supabase setup

1. Create a Supabase project. Run `supabase/migrations/001_initial.sql` once in its SQL editor, then run `supabase/seed.sql` to load the 12 owned Insignia filaments. The seed is idempotent and preserves availability changes.
2. **Disable public signup** in Authentication settings. Configure the site URL and redirect allowlist for `http://localhost:3000/auth/callback` while developing and the production callback when deploying.
3. Create the first admin user in the Authentication dashboard. The migration allows this initial user to exist without a profile. In the SQL editor insert that user's actual UUID into `public.profiles` with role `admin` and a display name. A unique index permits only one admin. This is an operator-only step; never ship a client action for it.
4. Set up custom SMTP for Supabase authentication mail, for example using Resend's SMTP credentials. Supabase's default mail service is restricted and is not sufficient for family invitations. This SMTP setting is separate from the app's `RESEND_API_KEY`.
5. For invitation and recovery templates, use a confirmation URL based on `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=invite` (or `type=recovery`). The callback verifies the token and opens the password form. Configure production Site URL before sending real invitations.
6. The admin can invite members through **Family & settings**. The trigger creates member profiles only for matching email invitations. Sofia is a recipient without an account. The recipient picker also includes invited names; add additional recipient rows through the SQL editor if needed.

Supabase RLS is required. Order changes use transactional RPC functions with version checks. Member profiles are not client writable. Order images use a private bucket and signed URLs; server actions validate uploaded bytes, type, size, and order ownership, then atomically attach staged images using the order version. Up to five reference images totaling 3 MB fit within the host’s request size limit. References and review feedback are visible to the submitter and admin. Treat signed URLs as temporary bearer links and avoid sharing them outside the family.

## Email setup

Verify a sending domain or subdomain in Resend, then set `RESEND_API_KEY`, `EMAIL_FROM`, and `APP_URL`. Notifications to the admin use the admin auth account's email; create that account with the intended review inbox. Other notifications use the submitter's account email.

Order changes and notification jobs commit together. Delivery is attempted immediately after submission or a decision. Failed deliveries remain in the outbox; the admin can use **Retry pending emails**. Retries back off, and stop after eight attempts or 23 hours from the first attempt to stay within the provider’s deduplication window. The admin retry result reports jobs needing reconciliation. Check the Resend delivery log before manually marking a job sent or resetting its attempts and first-attempt timestamp in the SQL editor; never blindly resend an uncertain delivery. Optional external automation may POST `/api/notifications` with `Authorization: Bearer <NOTIFICATION_SECRET>`. No paid scheduler is required. Email links require signing in and do not themselves approve orders.

Comment threads and feedback are visible in the app. Comment emails are not enabled in this version.

## Deploy to Vercel

1. Import the GitHub repository as a Next.js project on the free Hobby plan for this personal family app.
2. Configure environment variables using Vercel's encrypted settings. Set `APP_URL` to `https://prints.jaclyncarey.com` and match Supabase's URL/redirect settings.
3. Deploy a preview and exercise login, invitations, references, submissions, approval, edits, holds, completion, and email delivery with test accounts.
4. Add `prints.jaclyncarey.com` in Vercel's domain settings. Add the exact DNS record Vercel supplies at the domain's DNS provider. Keep the root domain's GitHub Pages records intact.
5. Verify HTTPS and the complete live flow before inviting everyone.

No accounts, deployments, real invitations, DNS records, or purchases are created by this source repository. Free providers have quotas, and Supabase may pause after inactivity. Keep backups appropriate to your usage.

## Verification

```sh
npm test
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

Unit tests cover request validation and transitions. PGlite tests execute the migration in embedded PostgreSQL with Supabase auth/storage stand-ins and exercise role policies and guarded mutations. Browser tests exercise the demo at desktop and phone sizes. These tests do not replace a live Supabase Auth/Storage/SMTP and Resend smoke test.

## Scope

No printer connection, automatic MakerWorld parsing, slicing, print-time estimates, remaining-filament quantities, or payments. Customization is entered as notes and images. Parts are stored as a validated JSON array on each order to keep the family-sized schema simple. Filament availability and production states are managed manually.
