# Bilingual catalogue content migration

This is an optional, additive follow-up migration for persistent Nepali product and category content. It is **not a prerequisite for the initial storefront release**.

## Scope

- `products.name_ne`, `products.description_ne`, `products.fabric_ne`
- `categories.name_ne`, `categories.description_ne`

All fields are nullable. Existing rows remain unchanged, and no product is published or translated automatically. Existing RLS policies and grants remain in force; this migration does not broaden public access.

## Current release compatibility

The application supports the current production schema (through migration `0018_security_function_acl`):

- Public product listings retry with the legacy English-only column selection when the optional Nepali columns are absent.
- Category reads use the existing category fields and safely fall back to English when Nepali values are absent.
- English-only product and category creates/updates retry without the optional Nepali fields when the columns are absent.
- If an administrator enters Nepali catalogue text before the migration is installed, the save is rejected with a clear migration-required message; the application does not silently discard the translation.
- The language toggle and translated interface remain available. Catalogue content falls back to English until Nepali content is saved after the migration.

Therefore, **do not apply this migration as part of the initial storefront release**. The existing production database and legacy source project remain untouched.

## Future rollout

1. Confirm the authoritative source/target database relationship and take a verified backup.
2. Review `drizzle/migrations/0019_bilingual_catalogue_content.sql` for the intended project.
3. Apply the additive SQL to the confirmed target project.
4. Verify all five columns exist.
5. Enter and review Nepali catalogue text through the admin product/category editors.

## Rollback

If no Nepali content has been entered, remove the five nullable columns in a reviewed rollback. If translations have been entered, export them first; dropping the columns destroys that content.

This migration remains committed for a separately scheduled schema rollout. No production schema change is executed by this release.
