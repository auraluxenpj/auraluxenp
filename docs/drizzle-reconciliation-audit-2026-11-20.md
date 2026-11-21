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


## Recheck addendum — 2026-11-20 11:xx local

A second comparison was performed against the live Supabase migration listing and the current `main` repository files.

- The live migration listing returns all 18 named migrations, `0000_auraluxe_core_schema` through `0017_product_model_code`.
- The current repository contains SQL files 0000–0017, including the exact 0015, 0016 and 0017 files.
- The Drizzle journal currently ends at idx 16 / `0016_inventory_sync_push_guard`; it does not contain the 0017 entry.
- Snapshot files 0000, 0015 and 0016 remain empty shells. There is no 0017 snapshot.
- The current production catalog confirms the 0017 model_code column, check constraint and partial expression index.
- The 0015/0016 live inventory-sync objects and service-role-only function permissions were inspected separately. Their existence and present definitions do not prove that historical SQL checksums match.

### Clarification of the older shared-inventory warning

`SHARED_INVENTORY.md` contains an earlier November 12 warning about an unmatched historical database migration row and missing 0015/0016 records. The current Supabase migration API now lists 0015 and 0016 by name, and lists the full sequence through 0017. Therefore, the earlier missing-record statement is historical and must not be presented as the current ledger state. The older reported core SQL hash mismatch remains unverified by this recheck; the available migration-list API exposes versions and names, not source checksums.

### Decision

Do not edit migration SQL, journal, snapshots, or Supabase's migration history yet. The repository metadata is conclusively incomplete, but a valid Drizzle snapshot cannot be inferred from empty shells. A full schema-only export and a Supabase-compatible isolated baseline are still required. No paid development branch was created and no production changes were made.


## Source-to-ledger SQL verification — 2026-11-20

A direct read-only comparison was completed for **all 18 migrations**. For each migration, the exact SQL text stored in `supabase_migrations.schema_migrations.statements[1]` was compared with its corresponding checked-in `drizzle/migrations/*.sql` file from `main`.

**Result: 18 of 18 exact text matches**, including the core migration 0000 and inventory-sync migrations 0015/0016 plus model-code migration 0017. This resolves the older reported core SQL hash mismatch for the current checked-in source and production migration record. The migration-list API alone did not expose checksums; the direct stored-statement comparison provided stronger evidence.

This verifies the applied migration statement text against the repository SQL files. It does **not** prove that no later manual schema drift occurred, nor does it repair Drizzle's empty snapshots or missing journal entry 0017.

### Updated conclusion

- Migration ledger: complete, 18 entries.
- Repository SQL sequence: complete, 18 files.
- Applied SQL text vs repository SQL: exact match for all 18.
- Drizzle metadata: still incomplete (journal missing 0017; snapshots empty; schema file blank).

The remaining blocker is strictly the Drizzle schema/snapshot baseline and any post-migration drift review. Do not rewrite migration history or replay migrations. Production remains unchanged.
