# Auraluxe Phase 1 — Secure checkout and remove COD

## Production safeguards

Keep the existing Lovable Cloud connection, routes, catalogue, accounts, orders, content and image storage. Preview currently shares the Live database: database changes take effect immediately even without publishing app changes. Therefore **do not apply migrations or change live payment settings in this thread before backup evidence and owner review**.

Current baseline is recorded: `cod,bank_transfer`, a `cod` database default, 10 products, no variant rows, one admin account, and two pending/unpaid COD orders totalling Rs. 3,744 and Rs. 2,600. Order and item fingerprints are recorded for later comparison; they are not backups.

### Owner actions required before implementation

1. **Owner-confirmed newest backup timestamp: October 21, 2026, 3:04:14 PM UTC (2026-10-21T15:04:14Z).** Recorded from the owner's report; this chat cannot independently read the backup inventory.
2. **Owner confirms the full database export was downloaded.** Retain it securely; do not upload account/password data into chat. The supported process is **More → Database → Manage → Settings → Export data → Database → Export → Start export**. The export includes schema, records and accounts. It is limited to one export per 24 hours, database size 15 GB and export size 5 GB.
3. **Owner confirms required storage files were downloaded separately**, including product images. Neither snapshots nor the database export includes storage files.
4. Supply the genuine merchant QR image and bank transfer instructions. Do not enable an incomplete payment method.

If a backup cannot be verified, stop before production-affecting changes. Restores roll back schema and data, lose later writes, and cause temporary unavailability; they are not a routine undo mechanism.

## Reviewable implementation steps

### 1. Isolated implementation

After the plan and backup gate are approved, create a separate draft for the checkout work. Confirm its backend/migration isolation before any database operation. If an isolated environment cannot be verified, prepare code and proposed SQL only; do not mutate Live. A draft is not a verified backup or guaranteed data clone.

### 2. Trusted checkout

Replace the browser's two direct inserts with a validated server checkout call and one transactional database operation. Preserve guest checkout, but permit it only through the trusted workflow; an unsigned caller cannot choose a user ID or access private orders.

- Accept product/variant selections, integer quantities, customer details, coupon code, approved payment method and an idempotency key—not prices, discounts, totals, paid status or roles.
- Read published products, current prices, shipping/tax settings and coupon rules from trusted database records.
- Validate product stock; validate size/colour against product selections when no variant rows exist. When variants exist, validate the exact matching variant and its stock.
- Lock affected stock and coupon records in a consistent order. Apply stock reservation and coupon usage within the same transaction as order/items. Track reservations so rejection/cancellation/expiry can release stock once, without double adjustments. Enquiries never reserve stock.
- Validate product/category-specific coupons, minimum eligible spend, active dates, usage limits and allowed discount values; calculate money with database numeric precision.
- Atomically save item snapshots and calculated totals. Any validation/item failure rolls back the order, reservations and coupon usage.
- Scope duplicate requests securely, compare their normalized request fingerprint, and return the same order only to the original caller. Never expose an order merely because someone supplies another customer's idempotency key.

### 3. QR/bank transfer and payment review

- New orders accept **QR payment and bank transfer only**, and only when genuine settings are complete and enabled.
- Add admin payment configuration and payment-review pages under the existing protected admin layout.
- Add private payment-proof storage; validate file type/size and ownership. Public product-photo access remains unchanged.
- Track **awaiting payment → proof submitted → under review → paid/rejected**, plus authorized refunds. Screenshot submission never marks paid.
- Require an authenticated administrator and an explicit verification action recording reviewer, timestamp and transaction reference before payment is marked paid. Refunds must record actual refund verification, not just a requested refund.
- Return payment instructions and a secure order receipt/proof submission mechanism; guest access must use a high-entropy order-scoped token stored as a hash, never an order number alone.
- Block checkout with a clear configuration message if neither method is configured.

### 4. Remove COD without rewriting history

- Remove COD from the selector, settings, copy and metadata, defaults and fallbacks.
- Require an explicit approved method for new orders; remove the `cod` database default.
- Use **INSERT-only** database enforcement to reject COD on new rows. Do not add a blanket rule that blocks updates to legacy COD orders.
- Keep legacy IDs, totals, item snapshots, payment methods and history unchanged. Preserve administrator viewing and management access.
- Coordinate the final database security activation with the reviewed app release: removing direct inserts prematurely would break the currently published checkout. No activation or publishing until the owner reviews passing results.

### 5. WhatsApp enquiries

Use **+9779709039488**. Add “Enquire on WhatsApp” with URL-encoded product name, SKU, selected size/colour, quantity and a unique enquiry reference. Record the enquiry securely before opening WhatsApp; show a retry state if recording fails. Enquiries are not orders or payment confirmations and do not affect stock.

## Proposed schema migrations and security changes

These are proposals for review, **not applied migrations**. Exact SQL will be presented in small steps before each application in the verified isolated environment.

| Proposed change | Security and compatibility |
|---|---|
| Add checkout request/idempotency records and nullable request linkage on orders | Unique request scope and normalized payload fingerprint; historical orders need no backfill |
| Add order payment-workflow state and secure guest-access token hash | Keep existing `payment_status` enum/column intact; populate new workflow only for new orders |
| Add payment configuration records | Admin-only writes; expose only enabled merchant instructions needed by checkout, never private verification details |
| Add payment proofs and append-only verification/payment events | Order-owner scoped submission; admin-only review; audit reviewer and verified transition |
| Add stock reservation records linked to new orders | Atomic stock handling, expiry/release and once-only application; no historical stock deductions |
| Add enquiries | Controlled submission, admin-only reads, no order/payment/stock side effects |
| Add transactional checkout and verification database functions | Restricted execution; authorization within every function; fixed search path; no caller-controlled roles/prices/ownership |
| Add insertion and payment-transition enforcement | Reject new COD and unauthorized paid/refunded transitions; allow approved legacy management |
| Retire unrestricted orders/order_items INSERT policies and grants at activation | Customers cannot bypass checkout; retain protected owner/admin reads and authorized administrative management |
| Add new private proof bucket and storage policies | No changes to existing product files, signed links or bucket configuration |

Every new public table receives explicit grants, row-level security, and scoped policies in the same migration. Use additive fields/tables; do not drop/rename columns or change existing enum/column types. Apply quantity/amount constraints to new submissions without invalidating historical records. Database functions, triggers and unique indexes enforce transaction integrity and duplicate prevention.

App-internal server operations use the existing TanStack Start server functions and authentication middleware. Genuine privileged work is isolated server-side, with database-backed admin checks. Maintain the existing CSRF protection and add checkout abuse controls.

## Tests and release gate

Run existing CSV tests and add concrete automated checkout/payment rules tests. Let the platform run builds; inspect the latest result rather than manually running a build.

In the isolated environment, exercise real configured QR/bank submissions and verify their saved orders through the UI. Test:

- COD rejection through checkout, server calls and direct database/API inserts.
- Browser price/total/payment-status/role tampering and forged ownership.
- Zero, negative, fractional and excessive quantities; unpublished, unavailable and mismatched variants; concurrent stock requests.
- Coupon category/product misuse, expiry/minimum/usage limit violations and concurrent use.
- Duplicate request replay and different-payload reuse.
- Forced item failure with no partial order, stock change or coupon consumption.
- Unauthorized proof access, paid/rejected/refunded transitions and verified-admin review.
- Legacy COD fingerprints unchanged; administrator can still view/manage legacy orders.
- Existing sign-in, administrator access, catalogue, uploads and product images.
- Enquiry reference/content persistence with no order, payment or stock change.

Before release, report exact schema/app changes, passed/failed tests, any checks that could not run, configuration still missing and the activation sequence. **Do not publish or activate production restrictions until the owner reviews the results.**

## Current status

The owner confirmed the newest backup timestamp as **October 21, 2026, 3:04:14 PM UTC (2026-10-21T15:04:14Z)** and confirmed database export and storage downloads are complete; these are owner-reported, not independently inspected. The isolated Payment Settings review draft has been started. Genuine merchant payment details remain unavailable. Production activation still requires isolation verification, passing tests and owner review; recording this timestamp does not authorize deployment.