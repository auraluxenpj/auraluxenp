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
