# Phase 1: Secure checkout and remove COD


## Smart Product Upload Upgrade (Oct 26)
- [x] Inspected existing product routes (admin list/editor, CSV import/export), Supabase setup (products, product_variants, categories; Lovable Cloud active) and inventory logic (per-size variants with product.stock as sum fallback).
- [x] Owner chose AI description & SEO + AI auto-fill details on a new quick-add page.
- [x] Built /admin/products/quick: name + optional notes + photos → admin-only AI server function drafts description, SEO title/description, fabric, category, sizes, colours and SKU garment kind → review/edit → save creates the product. "Smart add" button on the products page. No schema changes.
- [x] 3 sanitize tests pass; build OK; signed-in browser test: real AI draft generated (cotton/maroon/kurti category correct), hidden test product saved as AL-K-QA1 then deleted; catalogue unchanged. Not published.

## Home-screen installation
- [x] Add official circular icons, safely padded maskable icon, Apple touch icon, local favicon and standalone manifest without service workers or business changes.
- [x] Three tests passed; all icons/manifest HTTP 200 with correct sizes, safe maskable artwork and no Chromium installability errors. Install/launch commands succeeded; headless standalone window display and physical Android/iPhone checks remain unverified. Existing HTTPS site returns 200, automatic build OK, homepage/shop render without page errors.
- [x] Requested deployment of the validated current snapshot to https://www.auraluxe.com.np; scheduling is confirmed, completion is not. File report and device instructions are in PWA.md.
- [ ] Verify deployed manifest and installation on real desktop/Android/iPhone devices; blocked until the new deployment is available and physical devices can be used.

## Vendors and purchase bills
- [x] Owner approved additive admin-only plan; migration 0014 adds private vendors, immutable bills/items/payments and authenticated transaction/read functions. Stock and daily cashflow unchanged.
- [x] Purchases navigation with vendor create/edit/search/balances, itemised invoice entry, discount/tax totals, due/status filters, bill details and partial/full Cash or Bank/QR payment history. Separate bookkeeping only, no uploads or actual transfers.
- [x] 18 purchase/Khata focused tests pass; signed-in vendor create/edit and invoice 2147 → 300 cash → 1847 bank/QR persisted as paid. Mobile fits, no page errors; latest build OK. Same retries return original; changed retries, normalized duplicate invoice, fractional/future payments and direct writes denied; simultaneous 700 payments against 1000 yield one success. Forged browser total/paid ignored; anonymous read/write denied.
- [x] Disposable QA records removed; original 69 products and 2 orders retained. Staff-session denial not independently exercised (no staff account); admin-only RLS/RPC and unchanged POS-only shell inspected. Not published.

## Customer Khata and expenses
- [x] Owner approved additive admin-only settlement/expense plan. Migrations 0012/0013 add private append-only records, customer locking, idempotent writes and consistent statement snapshot; existing sales/credit unchanged.
- [x] Searchable Customer Khata, sales/repayment statements, partial/full cash or merchant-confirmed QR repayments, numbered thermal/A4 vouchers and net balances shared with POS.
- [x] Expenses page records category/source/date/amount/payee/notes/slip reference; Nepal-day cashflow uses cash POS totals + cash recoveries − cash expenses, excludes QR/bank.
- [x] 38 focused tests pass; signed-in 1000 credit → 300 repayment → 700 balance, concurrent 500 repayments give one success, full settlement reads 0 in POS; cashflow 850+300−150=1000. Configured QR repayment and bank expense excluded from cashflow; changed retries/overpayment/unconfirmed QR denied. Voucher print/mobile verified; no page errors, latest build OK.
- [x] Disposable test records removed and original catalogue/orders preserved. No publication; genuine QR funds and physical printer not independently verified. New modules remain admin-only; no staff accounts available for staff-session testing.

## POS & in-store counter billing
- [x] Inspect shared stock, protected admin access, payment boundaries and current records; resolve admins-and-staff access and ordinary receipts.
- [x] Owner approved additive POS schema/security plan. Added private POS tables and authorized transaction/read RPCs (0010), tightened inherited grants explicitly (0011); online checkout unchanged. Not published.
- [x] Built counter search/filter/SKU and size/colour picking, 10-second stock refresh, cart discounts/tax, saved customer/credit balance and cash/merchant-confirmed QR/Udharo payments. Staff navigation is limited to POS.
- [x] Atomic completion and shared overall/size stock deduction; immutable receipt snapshots, private credit ledger and Nepal-day sales totals/reprints. A4 and 80mm print output visually verified after fixing an initially blank print.
- [x] 36 focused tests pass; signed-in cash (1000 − 100 − 50 = 850, tender 1000/change 150) and Udharo (1000 balance) verified through UI/ledger; sold-out size, duplicate-line overdraw, changed retry, guest credit and unconfirmed QR rejected; same retry returns original sale. Two concurrent requests for one size unit yielded exactly one success. Signed-out reads/writes blocked, latest build OK.
- [x] Disposable test sales/customer/products removed; final baseline 69 products, 0 variant rows and 2 original orders retained. Real QR settlement and physical printer are not independently verified; no staff accounts currently exist for a staff-session test. Staff account provisioning and provider auto-verification are outside this module.

## Product information standards
- [x] Add AL garment-type admin-suffix SKU editing; legacy SKUs remain until admin review/save, and new imports/copy publication require the format.
- [x] Add BIBA-sourced S–XXL women's body-size guidance without replacing custom garment charts or inventing larger measurements.
- [x] Show the polished photo variation disclaimer alongside all product descriptions, including products with no description.
- [x] 23 focused tests pass; signed-in draft creation/save/reload/deletion and mobile chart/disclaimer verified without page errors; automatic build OK. Not published.

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
- [x] Server-side per-size stock enforcement (migration 0008 `per_size_stock_checkout`): `place_order` now aggregates duplicate lines per product (fixes the duplicate-line overdraw), validates overall stock per product and the chosen size's variant stock (locked rows), and deducts both; migration 0009 `restock_size_variants` returns stock to the size's variant row on admin restock. Owner approved. DB-tested: sold-out size refused, duplicate-line overdraw refused, real order deducted S 2→0 and product 5→3 (total 1150 correct), admin restock restored both. Test order/product removed; 69 products + 2 legacy orders unchanged.

## Low stock warning removal (Oct 24, 04:30 UTC)
- [x] Low stock warnings removed: the shopper-facing "Only N left" line on product pages, and the dashboard's "Low stock" stat card and list. Build clean; dashboard and product page checked signed in.
- [x] SKU review: admin now builds codes with the shop's own garment letters (`PW` `CO` `S` + `K` `SU` `D` `G` `PZ` `SH` `T` `OTH`), so the 35 codes already in the catalogue stay exactly as they are. "AL- CO-665" typo fixed to `AL-CO-665`; the four real products that had no code filled as `AL-PW-702`, `AL-CO-703`, `AL-PW-704`, `AL-PW-705`. Left for the owner: 33 Rs 0 test entries and `AL-S-693/694`.

## Publish (Oct 24, 04:36 UTC)
- [x] Fresh security scan before publishing: 3 findings, all previously dismissed by the owner (product-images download rule, site_settings and pages public reads). No new or unresolved critical findings.
- [x] Published to https://www.auraluxe.com.np; page returns HTTP 200 with the Auraluxe title.
- [x] Live product pages verified: `AL-CO-665`, `AL-CO-703`, `AL-PW-702` show correctly, the photo disclaimer and women's size chart render, and the "Only N left" low stock line is gone.
- [ ] Owner decisions still open: 33 Rs 0 test entries, `AL-S-693/694` (one code, two items), prices for Modish Aqua Blue and Trendy Cream Designer (still Rs 0).
