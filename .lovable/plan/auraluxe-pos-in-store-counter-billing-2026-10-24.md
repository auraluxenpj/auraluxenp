# Auraluxe POS & in-store counter billing

## First module
Add **POS Billing** to the existing admin navigation. Admins and staff can use the counter and sales ledger; staff cannot access product editing, payment settings or other admin management pages. Existing accounts and roles remain unchanged.

- Fast product-name and SKU search, category filters, real product photos, size/colour selection and live available stock. Sold-out choices cannot be billed.
- Quick cart with quantity controls, per-item and cart discounts, current tax settings, subtotal and final total. Discounts start as fixed rupee amounts, with clear limits; authoritative totals are calculated when saving.
- Walk-in guest or saved customer/party lookup by name/phone; create a customer with name and phone and show their outstanding Udharo balance. Credit requires a saved customer.
- Cash with tendered amount/change; genuine configured QR with explicit cashier confirmation that funds reached the merchant; Credit (Udharo) adds the full outstanding amount to the customer's ledger. No automatic payment verification or invented QR.
- Complete a sale once: save the sale, receipt, credit entry if applicable, and deduct overall/per-size stock together. Refresh stock across the counter and storefront.
- Auraluxe-branded ordinary receipt in 80 mm thermal and A4 print formats, with invoice/receipt number, operator, date, customer, item/SKU/size/colour, discounts, tax, total and payment breakdown. **Not a registered tax invoice**; no invented PAN/VAT number.
- Sales ledger with date/payment filters, Nepal-local daily sales totals, credit totals and receipt reprint. Customer balances are derived from recorded credit entries, not editable numbers.

## Planned additive database/security changes
Create private `pos_customers`, `pos_sales`, `pos_sale_items` and `pos_credit_entries` tables. Each new table receives explicit grants and row-level policies for authorized admins/staff only; no public customer, credit or sale reads. These records are separate from online orders so counter cash and Udharo do not weaken the online QR/bank-only checkout.

Add a narrowly scoped admin/staff permission helper and an authenticated atomic `complete_pos_sale` database function. It validates options, quantities, discounts, configured tax and payment/customer requirements; locks products and variants in deterministic order; checks aggregate quantities across duplicate cart lines; recomputes prices from the catalogue; deducts both overall and tracked size stock; writes immutable sale-time snapshots and credit entries. A unique request key plus request fingerprint makes retries return the same sale and rejects changed requests.

Cash and QR record the authenticated cashier's confirmation; QR is not considered paid from a screenshot alone. Credit is recorded as outstanding. Direct customer sale writes and stock adjustment shortcuts are not permitted. Snapshot store identity and receipt breakdown at sale time so reprints do not change when products/settings change.

Reuse the existing genuine QR configuration through a narrowly authorized POS read, without giving staff permission to edit it. If QR is unconfigured, cash and credit remain available and QR is disabled.

## Technical implementation
- Dedicated protected `/admin/pos` and `/admin/pos/sales` pages; adjust the shared admin shell to admit staff only to these pages while retaining admin-only checks for existing children.
- Authenticated server functions with role checks for catalogue/customer/ledger reads and sale completion. Existing bearer middleware is retained.
- Central client-safe money/discount and availability helpers with focused tests; authoritative transaction rules live in the database.
- No changes to existing online orders, `place_order`, payment methods, accounts, catalogue contents, images, domain or deployment.

## Validation and release gate
Test concrete totals, discount bounds, credit customer requirement, guest cash, configured QR confirmation, per-size sold-out/quantity rules, duplicate retry safety, concurrent stock checks and atomic rollback. Verify an authenticated counter sale reads back through the ledger, prints correctly and updates shared stock; verify unauthorized access is denied. Use only clearly identified disposable test records and restore/remove them after validation.

Owner previously reported backup/export/storage copies from October 21; these have not been independently inspected. Before live schema activation, confirm recovery coverage remains suitable. Present test results for owner review; **do not publish automatically**.

## Excluded from this first module
Credit repayments, partial/split payments, returns/refunds, purchases, supplier accounts, expenses, staff-account provisioning and registered tax invoicing. Completed sales remain immutable; a future reversal/repayment module will append adjustments rather than rewrite receipt history.