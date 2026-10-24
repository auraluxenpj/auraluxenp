# Phase 1: Secure checkout and remove COD

## Admin category management
- [ ] Add category create/edit/delete and reviewable ordering in the protected admin panel.
- [ ] Preserve assigned products and coupons when deleting categories; reuse existing admin permissions.
- [ ] Verify category rules, signed-in management, storefront updates, and current app health. Do not publish.

- [x] Audit existing backend, checkout paths, payment settings and legacy order baseline.
- [x] Record owner-confirmed newest backup timestamp: October 21, 2026, 15:04:14 UTC (2026-10-21T15:04:14Z); not independently inspected.
- [x] Owner confirms supported full database export downloaded (not independently inspected).
- [x] Owner confirms required storage files downloaded (not independently inspected).
- [x] Review planned schema/security changes and isolated draft approach with owner.
- [x] Create isolated implementation draft; isolation verified — draft code is on its own branch, but the database is the shared live one, so all schema changes are staged (never applied) under the draft's migrations folder.
- [x] Stage payment settings schema: private `payment_settings` singleton, `payment_settings_audit` (real changer + timestamp via trigger), admin-only RLS/grants, disabled unconfigured defaults.
- [x] Stage trusted atomic checkout: `place_order` database function (server-computed prices/stock/coupon/shipping/tax, idempotency key + fingerprint, guest checkout preserved via auth.uid()), orders.checkout_key/request_fingerprint columns, INSERT-only rejection of COD and any non-QR/bank method, retirement of direct anon/auth order insert policies and grants.
- [x] Stage private `payment-qr` storage policies (admin-only; customers get short-lived signed links). Blocker: the bucket itself must be created with the storage tool at activation time — SQL cannot create buckets and creating it now would mutate the live backend.
- [x] Build admin Payment Settings page (QR upload/preview/replace/remove with magic-byte validation, no SVG, no cropping; bank fields; enable toggles; audit history) under the existing protected admin layout.
- [x] Rewrite checkout: only enabled+configured QR/bank methods shown, blocks with WhatsApp fallback when none configured, COD selector/default/copy removed, totals recomputed server-side, payment instructions shown after order placement.
- [x] Add payment rules tests (9) and run existing CSV tests (3) — all 12 pass.
- [ ] Activate at draft accept: create `payment-qr` bucket (private, 5MB limit) via storage tool, then owner enters genuine QR image + bank details in admin. Blocked: no genuine merchant details supplied yet.
- [ ] After activation, test with a real admin session: settings save/refresh, QR upload, checkout with genuine QR/bank, disabled methods, unauthorized reads/writes, direct COD API rejection, atomic insert rollback, legacy COD fingerprints unchanged, auth/admin/products/images. Blocked: staged tables/functions do not exist in the draft until accept.
- [ ] Run full Phase 1 automated and end-to-end tests; compare legacy order fingerprints and catalogue/auth/image preservation — blocked by backup gate and activation.
- [ ] Present results and required configuration; wait for owner release approval. Do not publish or accept the draft without owner review.
