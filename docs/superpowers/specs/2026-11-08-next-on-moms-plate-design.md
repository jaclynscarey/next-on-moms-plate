# Next on Mom's Plate

Approved design, November 8, 2026. Target: prints.jaclyncarey.com.

## Purpose and experience

An invite-only family dashboard replaces scattered print wish lists with complete requests, a fair shared queue, and a history of completed prints. Jacky is the only administrator. The approved visual concept uses playful color, clean print cards, and a responsive layout for phones and desktops.

## Requirements

- Accounts belong to invited users. Sofia is a recipient without an account; another user submits for her. Every order records its submitter and recipient separately.
- One MakerWorld model per order. Required information: model URL, quantity, recipient, and user-named parts with a filament selection or special-filament request for each part. A simple notes field handles personalization, variation, size, and differences between copies. Reference images are optional.
- Jacky maintains a filament library with brand, material, color/name, optional image, and manual availability. No remaining-weight tracking.
- Submission and resubmission notify the admin by email with an order review link. Jacky approves, denies, or requests changes; approval is required before joining the queue.
- Approved orders are sorted by immutable original submission time. The oldest ready order prints next. Orders on hold retain their timestamp and do not block ready orders.
- Submitters may edit or cancel before Printing. Edits require approval again without resetting submission time. Replacing the MakerWorld model requires a new order.
- All invited users can see the family queue and completed history. Each order has a comment thread for its submitter and admin.
- Approval, denial, requested changes, and completion notify the submitter by email. Comment notifications are a proposed default, not a separately confirmed requirement.
- Anyone invited can use Request again on a completed print. This copies editable request details into a new order with a new submission time and approval requirement.

## States and proposed implementation defaults

Awaiting Approval, Changes Requested, Queued, On Hold, Printing, Completed, Denied, Cancelled. Jacky manually updates production states. Queued and On Hold are approved states; the admin records a hold reason and explicitly releases a hold. Completion represents the entire requested quantity. A failed print may return to Queued or On Hold through an admin action, preserving original priority. These retry mechanics are implementation defaults, not separately confirmed user decisions.

Use email/password accounts with invitation acceptance and password recovery. Public signup is disabled. Review links open the order after authentication and require the admin role; an email link alone cannot approve a request. Other invited users see order details, but only the admin and submitter participate in its discussion. Authorization is enforced by the server and database, not just hidden buttons. Uploaded images live in private storage. Secrets, real family email addresses, and real order data do not belong in the public repository.

## Approaches considered

1. GitHub Pages frontend with managed backend: preserves static hosting but splits deployment and backend behavior.
2. Separate full-stack application: selected by the user. Next.js and TypeScript on Vercel, Supabase PostgreSQL/Auth/Storage, Resend transactional email, source on GitHub. The portfolio remains on GitHub Pages.

Target free plans; paid upgrades are optional. Free-service limits and Supabase inactivity pauses remain operational constraints, not availability guarantees. Deployment needs provider accounts, credentials configured outside source control, DNS access, and a verified sending domain.

## Boundaries

No printer control, automatic slicing or MakerWorld part extraction, print-time estimates, filament-consumption accounting, payments, public registration, or automatic filament purchases. Special-filament requests express a preference; Jacky decides whether to purchase. Build a small app rather than an extensible commerce platform.

## Acceptance

An invited user submits a complete request; the admin receives a review notification and approves through an authenticated page; the shared queue selects the oldest ready order; edits revoke approval; completion sends a notification and enables a fresh reorder. Unauthorized users cannot read family data or perform admin actions. The interface works on a narrow phone screen. Missing provider configuration offers a clearly labeled local demo without pretending that requests or emails were saved remotely.
