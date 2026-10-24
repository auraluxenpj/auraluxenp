# Phase 1: Secure checkout and remove COD

## BIBA-inspired redesign (Oct 24)
- [x] Sticky header with category dropdown + mobile drawer; announcement bar with admin on/off toggle.
- [x] Hero carousel (autoplay, pause-on-hover, arrows, dots, reduced-motion, desktop/mobile image via `<picture>`) driven by live hero banners, default fallback hero.
- [x] Shop-by-category tiles (category image or first product photo fallback), empty sections hidden on homepage, editorial tiles, testimonials/social kept.
- [x] Admin → Banners page: create/edit/duplicate/delete (confirm), publish/unpublish (drafts), drag reorder, campaign dates, hero/promo placement, desktop+mobile uploads to existing product-images storage with type/size checks and dimension/file info, link validation, announcement bar editor.
- [x] Schema: additive `banners.mobile_image_url` column only. No data, auth, checkout, or payment changes. 19 tests pass; build OK; homepage screenshot-checked desktop + mobile.
- [ ] Not yet done: homepage section ordering controls, wishlist, quick view. Owner to test banner upload/reorder signed in, then publish.
- [ ] Catalogue contains test-named products (e.g. "hnfg", "dfrdg", "dsgbsf" at Rs. 0) from earlier testing — owner may want to remove them in admin.

## AI stylist + order tracking (Oct 24)
- [x] `/stylist` page: occasion/style/budget form, `recommendProducts` server function streams openai/gpt-6-astra with strict JSON picks by product id, only live published in-stock products returned, friendly gateway error messages. Footer link added.
- [x] `/track` page + `trackOrder` server function calling new `public.track_order` DB function (migration 0006): order number + phone/email both required, returns limited summary (status, payment, tracking number, items, total); no address exposed. Footer link added.
- [x] Verified in preview: real AI picks in ~10s within budget, real legacy order lookup works, wrong contact shows "not found", 19 tests pass, build OK. Not published.

## Stylist add-to-bag + publish (Oct 24, 03:09 UTC)
- [x] Each AI Stylist recommendation now has its own "Add to bag" button plus a "View" link, and an "Add all N to bag" button above the grid; sold-out picks are refused. Rules live in `src/lib/stylist-cart.ts` with 6 tests (25 total pass). Browser check: 6 picks → per-card add then add-all left 7 items in the bag at correct sale prices.
- [x] Published /stylist and /track (with the add-to-bag buttons) to https://www.auraluxe.com.np; fresh security scan cleared the old checkout-price warning, remaining findings are the user-ignored product-images rule and intentional public storefront reads.




## October 24 release review
- [x] Check both draft statuses: Payment Settings draft accepted; current review draft matches main and has no additional code changes.
- [x] Run payment rules and CSV tests: 12 passed.
- [x] Inspect live activation: payment settings and place_order exist; QR and bank toggles enabled with configured fields; private QR bucket contains one image. Genuine ownership of merchant details was not independently verified.
- [x] Check current records: 69 products, 1 profile, 507 product images; both baseline COD orders remain with their IDs and totals, now cancelled. Changes since the earlier baseline were not made by this review.
- [ ] Resolve release risk: place_order checks duplicate product lines separately before decrementing stock, allowing aggregate quantities to exceed stock. Awaiting owner decision before further implementation or publication.
- [ ] Complete real checkout/admin acceptance tests and legacy item fingerprint comparison. Initial browser check showed loading states, not a verified flow.
- [ ] Publish requested drafts after release review and owner decision; no publication requested in this review yet.

## Admin category management
- [x] Add category create/edit/delete and reviewable ordering in the protected admin panel.
- [x] Preserve assigned products and coupons when deleting categories; reuse existing admin permissions. No schema or policy changes.
- [x] Verify category rules, signed-in create/edit/reorder/delete, refresh persistence, storefront updates, used-category deletion blocking, and signed-out redirect. All 19 tests pass; automatic build OK. Temporary category removed; original categories retained. Not published.

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
- [x] Product photo zoom: pinch on mobile, click on desktop

## Size & colour prompt + per-size stock (Oct 24)
- [x] Add-to-bag asks for size and colour first: quick chooser dialog on product cards, explicit selection on product page (no silent defaults). `src/lib/product-options.ts` + 5 tests.
- [x] Per-size stock on product pages: sizes show "N left"/"Sold out", sold-out sizes disabled, quantity capped to the chosen size. Data comes from `product_variants` rows (colour-agnostic, one per size); `src/lib/size-stock.ts` + 10 tests (42 total pass). Products without variant rows keep the single product-level stock figure.
- [x] Admin product editor: "Track stock for each size" toggle with per-size stock inputs (S–3XL regular, 4XL–10XL plus — any size labels work); saving replaces the size rows and keeps the overall Stock equal to their sum. Browser-verified end to end (create → shop display → quantity cap → delete test product).
- [ ] Server-side per-size stock enforcement in `place_order` (validate + decrement the chosen size's variant stock, and fix duplicate-line aggregate overdraw) — planned, awaiting owner approval before the migration.
