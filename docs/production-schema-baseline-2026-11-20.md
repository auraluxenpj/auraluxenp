# Supabase production schema baseline (read-only inventory)

**Captured:** 2026-11-20  
**Project:** `auraluxe-production`  
**Project ref:** `jsshaoucrjorbyuzagdr`  
**Region:** `ap-south-1`  
**Purpose:** Record a verified metadata inventory before repairing Drizzle migration bookkeeping.

> This is an inventory checkpoint, not a schema dump or a migration. It contains no customer records, credentials, API keys, or secret values. Do not use it as a substitute for a reviewed canonical schema export.

## Live catalog inventory

Read-only queries against the live `public` schema returned:

| Object | Count |
|---|---:|
| Public tables | 27 |
| Indexes | 51 |
| Constraints | 89 |
| Triggers | 9 |
| Public functions | 26 |
| RLS policies | 42 |
| Recorded Supabase migrations | 18 |

All 27 public tables reported row-level security enabled.

The table inventory included:
`banners`, `business_expenses`, `categories`, `coupons`,
`inventory_sync_acks`, `inventory_sync_log`, `inventory_sync_state`,
`order_items`, `orders`, `pages`, `payment_settings`,
`payment_settings_audit`, `pos_credit_entries`, `pos_customers`,
`pos_repayments`, `pos_sale_items`, `pos_sales`,
`product_variants`, `products`, `profiles`,
`purchase_bill_items`, `purchase_bills`, `purchase_payments`,
`reviews`, `site_settings`, `user_roles`, and `vendors`.

## Migration bookkeeping findings

- The live Supabase migration history contains 18 entries, corresponding to migration files 0000–0017.
- The repository Drizzle journal contains entries 0000–0016 only.
- Migration `0017_product_model_code.sql` adds nullable `products.model_code`, a check constraint, and a partial expression index.
- The Drizzle schema file is intentionally blank.
- The checked-in Drizzle snapshots `0000_snapshot.json`, `0015_snapshot.json`, and `0016_snapshot.json` are empty metadata shells: no tables, enums, policies, or sequences.
- The 0017 snapshot is absent.
- `drizzle.config.ts` still points to `LOVABLE_DB_MIGRATION_URL`.
- No migration verification script is currently part of the storefront CI workflow.

## Important safety interpretation

The live database is not missing migration 0017. Its migration history records all 18 migrations. The mismatch is in repository-side Drizzle bookkeeping.

Do **not**:
- append a journal row without a valid corresponding snapshot;
- run Drizzle generate/migrate against production using the empty schema;
- replay historical migrations 0000–0017;
- modify Supabase migration history to make the counts match;
- infer that existing inventory-sync objects prove the source SQL and live definitions are identical.

## Security review queue

A read-only catalog query found multiple `SECURITY DEFINER` functions for which `anon` and/or `authenticated` have EXECUTE permission. This includes functions whose bodies appear to perform their own authorization checks, plus public-facing functions such as checkout/order tracking. The broad default EXECUTE grants need a function-by-function review.

In particular, inspect `has_role(uuid, app_role)` because it accepts a caller-supplied user ID and role. Do not revoke permissions in bulk: RLS policies and authenticated application flows may depend on these functions.

All reviewed `SECURITY DEFINER` functions should have a fixed, safe `search_path`; trigger functions and functions intended only for service role require separate privilege treatment.

## Next safe steps

1. Capture a complete schema-only export from the live project, including function definitions, grants, policies, indexes, constraints, triggers, sequences, and extensions. Store no data or secrets.
2. Compare each live object with the checked-in SQL migrations and record verified drift.
3. Establish a real Drizzle baseline from the live schema in an isolated scratch database. Generate and inspect snapshots there; never point Drizzle Kit at production for this repair.
4. Add CI checks for migration file/journal/snapshot consistency and SQL safety review.
5. Prepare narrowly scoped security changes as a separate reviewed change with regression tests.

## Scope of this checkpoint

This commit is documentation only. No production database, Cloudflare Worker, DNS, storefront content, or payment settings were changed.

## Function-level security review (read-only)

A focused review of the live definitions for POS, checkout, order tracking, and role helpers found:

- The reviewed functions are owned by `postgres`, marked `SECURITY DEFINER`, and set `search_path = public`.
- Their current ACLs include EXECUTE for `anon`, `authenticated`, and `service_role` (and the owner). This is broader than least privilege for several administrative functions, even where the function body performs an authorization check.
- `complete_pos_sale`, `record_pos_repayment`, `get_pos_catalog`, `get_pos_customer_balances`, and `get_pos_qr` check POS/admin authorization inside the function body. `get_business_day_summary` and `get_khata_statement` also check admin access. `restock_order` checks the admin role. These checks are useful defense-in-depth, but they do not remove the need to scope EXECUTE grants correctly.
- `place_order` is intentionally a public checkout RPC and performs server-side customer, payment-method, price, stock, coupon, and idempotency validation. Its anonymous execution is an expected public path and must not be removed without replacing the checkout flow.
- `track_order` is intentionally public and checks an order number plus a contact value. Its phone comparison accepts a matching suffix of at least seven digits. This deserves a privacy-focused review because a seven-digit suffix is a relatively short proof of possession for access to order status, totals, and item names. Do not change the customer-facing contract until an alternative verification flow is designed.
- `has_role(uuid, app_role)` is executable by anonymous and authenticated roles and accepts an arbitrary user UUID supplied by the caller. Its body only tests whether that UUID has the requested role. This does not grant that role, but it can expose role membership as an enumeration oracle. RLS policies currently call it, including policies evaluated for anonymous reads, so a safe remediation must consider policy dependencies rather than simply revoking anon EXECUTE.
- Trigger functions and functions intended for authenticated/service-role use must be reviewed separately from public RPCs.

### Recommended security remediation order

1. Trace every SQL RPC call in the app and every RLS policy dependency.
2. Add regression tests for anonymous storefront reads, checkout, order tracking, POS staff/admin authorization, and admin operations.
3. Design a safer order-tracking verification factor (for example, a one-time code or stronger contact proof) before tightening `track_order`.
4. Replace caller-selected identity in role-checking interfaces where feasible, or isolate the helper behind carefully designed policy functions; validate anonymous policy behavior.
5. Revoke or narrow EXECUTE grants only for functions proven not to require public access, in a dedicated migration with tests and rollback notes.

No grants, function definitions, policies, or production data were changed during this review.
