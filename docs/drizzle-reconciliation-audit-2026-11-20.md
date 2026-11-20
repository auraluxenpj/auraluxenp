# Drizzle / Supabase reconciliation checkpoint

Captured: 2026-11-20  
Production project: `auraluxe-production` (`jsshaoucrjorbyuzagdr`, Mumbai)

## Scope and safety

Read-only inspection of production PostgreSQL catalogs and repository migration files. No production DDL, grants, data, DNS, Worker settings, or storefront configuration changed. No Supabase development branch was created because none exists and branch provisioning can incur recurring compute charges requiring explicit cost approval.

## Verified migration inventory

- Repository SQL migration files `0000` through `0017` are present.
- Production Supabase migration history contains 18 records, named `0000` through `0017`.
- The Drizzle journal contains entries `0000` through `0016`; entry `0017_product_model_code` is absent.
- Migration `0017_product_model_code.sql` adds nullable `products.model_code`, a check constraint enforcing trimmed non-empty values up to 64 characters, and a partial expression index.
- The live `products.model_code` column, check constraint, and index are present. This is a repository metadata mismatch, not a missing production migration.

## Live catalog inventory

Production catalog inspection confirms:
- 27 public tables
- 51 indexes
- 89 constraints
- 42 RLS policies
- 9 non-internal triggers
- 26 public functions
- 3 public enum types: `app_role`, `order_status`, `payment_status`

All 27 public tables have RLS enabled. The live schema includes the product, order, payment, POS, vendor/purchase, and inventory-sync domains.

## Drizzle repository state

- `drizzle/schema.ts` is intentionally blank.
- Existing snapshots (0000, 0015, 0016) are empty metadata shells.
- Snapshot 0017 is absent.
- `drizzle.config.ts` points at `LOVABLE_DB_MIGRATION_URL`.
- There is no migration consistency command in `package.json` or current storefront CI.

## Interpretation

The production migration ledger is complete through 0017. The SQL migration sequence exists in the repository, but Drizzle Kit's schema and snapshot metadata are not a reliable representation of the live schema. Appending the missing journal entry alone would create a misleading state; it would not restore a valid baseline.

## Required next steps

1. Establish an isolated scratch database. A Supabase development branch is one option, but it may incur recurring compute charges; no branch has been created pending cost disclosure and approval.
2. Obtain a schema-only export including constraints, indexes, enum definitions, policies, triggers, functions and grants. Do not export customer or business data.
3. Generate Drizzle table definitions and snapshots against the scratch database only. Do not infer a complete canonical schema from the incomplete snapshots.
4. Reconcile journal metadata only after snapshot generation and a clean diff against the scratch database.
5. Add CI checks for migration file/journal alignment and snapshot integrity.
6. Keep security privilege changes in a separate reviewed migration with functional regression tests.

## Conclusion

The production migration history and repository SQL migration sequence agree on the full sequence 0000–0017. Drizzle metadata is incomplete and must be rebuilt as a verified baseline. Production is not ready for a Drizzle migration workflow until this is resolved.
