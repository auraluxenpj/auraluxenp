# Customer Khata & daily expenses

## Customer Khata
- Add **Customer Khata** to admin navigation, with customer name/phone search and each party's net Udharo balance.
- A dedicated customer statement shows all their POS sales, credit accruals, dated repayments, amounts paid and current outstanding balance; original receipts remain available for reprinting.
- Record partial or full repayments through Cash or configured QR. QR requires explicit confirmation of funds received; no screenshot-based automatic settlement.
- Generate an immutable numbered repayment voucher with customer, date, amount, payment method, cashier and remaining balance; reprint in the existing thermal/A4 formats.
- Update the POS customer balance lookup to subtract repayments, so the counter and Khata always agree.

## Daily expenses
- Add **Expenses** to admin navigation.
- Record date (Nepal local), category, amount, payee, Cash Drawer or Bank/QR source, notes and an optional receipt-slip/reference field. This first version stores the reference, not uploaded files.
- Categories: Packaging & Courier, Refreshments/Tea, Rent & Utilities, Shop Maintenance, Staff Allowance and Miscellaneous.
- Daily expense list and category totals, plus **Net Daily Cashflow = POS Cash Sales + Cash Credit Recoveries − Cash Expenses**. Bank/QR movements are listed but excluded from the cash-only figure. Cash sales use sale totals, not tendered cash including change.

## Data and safeguards for owner review
- Add private append-only `pos_repayments` and `business_expenses` tables with explicit grants and admin-only read policies. No changes to existing sales, credit entries, stock, online orders or checkout.
- New authenticated transaction functions record repayments and expenses. Repayments lock the customer, calculate credit minus prior repayments, reject zero/negative amounts and overpayments, and persist a voucher snapshot atomically. Unique request keys and fingerprints protect both forms against duplicate retries and changed requests.
- POS credit accruals and repayments coordinate through a customer lock when creating credit entries, without changing inventory or online checkout rules.
- A narrowly scoped admin/staff balance read returns net customer balances to POS, but does not expose repayment details or expenses to staff.
- New Khata/Expenses screens and writes remain **admin-only**, preserving the established staff-only-POS boundary; no role assignments or staff access expansion.
- Paginated complete ledger reads prevent hidden balances or totals when records exceed one query page; daily reports use Nepal's midnight boundaries.

## Verification and release
Add focused tests for net balance, partial/full repayment bounds and the exact cashflow formula. Verify signed-in repayment → statement → POS balance, expense save → daily summary, voucher print, duplicate retries, concurrent overpayment protection and denied public access. Use disposable test records and remove only those records afterward.

Existing recovery copies were owner-reported for October 21 and have not been independently inspected. Preserve production records; additive changes only. Show verification results and **do not publish automatically**.