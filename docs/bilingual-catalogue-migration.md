# Bilingual catalogue content migration

This migration adds optional Nepali fields while retaining the existing English fields as the required source/fallback.

## Scope

- `products.name_ne`, `products.description_ne`, `products.fabric_ne`
- `categories.name_ne`, `categories.description_ne`

All fields are nullable. Existing rows remain unchanged, and no product is published or translated automatically. Existing RLS policies and grants remain in force; this migration does not broaden public access.

## Deployment order

1. Back up the Supabase project and verify the target project ID.
2. Review `drizzle/migrations/0019_bilingual_catalogue_content.sql`.
3. Apply the SQL in the intended Supabase project's SQL Editor (the application has no migration command in its package scripts).
4. Verify the five columns exist on the correct project.
5. Deploy the matching application build only after the schema check passes.
6. Enter and review Nepali text through the admin product/category editors before publishing any new bilingual content.

**Do not deploy the application code before applying the migration.** The storefront selects the new product fields, and the admin editors write the new columns.

## Rollback

If no Nepali content has been entered, remove the five nullable columns in a reviewed rollback. If translations have been entered, export them first; dropping the columns destroys that content.

This file and the SQL migration are branch-only. No production schema change has been executed as part of this work.
