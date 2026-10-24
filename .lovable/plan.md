# Vendors & purchase bill tracking

## Admin experience
- Add **Purchases** beside the existing business-suite navigation, with **Purchase bills** and **Vendors** views.
- Searchable vendor directory: business/name, phone, optional email/address and notes; create and edit vendor contact information, and show total unpaid purchase balance.
- Record itemised vendor purchase bills: vendor invoice number, bill date, optional due date, item description, quantity, unit cost, fixed bill discount, tax rate, notes and optional receipt/bill reference. Compute subtotal, discount, tax and total from the entered lines.
- Bill list with vendor/name/invoice search and unpaid, partially paid, paid and overdue filters; bill details show original items, totals and dated payment history.
- Record partial or full payments via Cash or Bank/QR, with payment date, reference and notes; reject payments exceeding the remaining balance. Payments are bookkeeping records, not bank transfers or automatic QR verification.

## Safe scope
This is **admin-only purchase tracking**, not inventory receiving: saving a bill does not increase stock, create products, change online orders or alter the established cash-only daily expense report. Purchase payments remain separate from operating expenses to avoid double-counting. No file uploads in this version; keep a receipt/bill reference instead. Existing staff access remains POS-only.

## Additive data and security changes
- Create private `vendors`, `purchase_bills`, `purchase_bill_items` and `purchase_payments` tables with explicit grants and admin-only row policies; preserve existing data.
- Vendor contacts are editable. Saved bills, items and payment entries retain audit actor/time and are append-only; vendor names/contact details are snapshotted on each bill so later contact edits do not rewrite history.
- Authenticated database functions save bills and payments atomically, calculate totals from validated lines, reject invalid dates/amounts and duplicate invoice numbers for the same vendor (trimmed/case-insensitive).
- Unique request keys and payload fingerprints prevent duplicate retries; lock the bill when paying so simultaneous payments cannot overpay. Outstanding/status and vendor balances are derived from payment records.

## Validation and handover
Add focused tests for purchase totals, discounts, paid/partial/overdue status and payment limits. Verify signed-in vendor creation/edit, bill save/readback, partial/full payment history, duplicate invoice/retry rejection, concurrent payment bounds and signed-out denial. Remove only disposable test records; preserve catalogue, orders, credit and expenses.

Owner-reported October 21 recovery copies have not been independently inspected. Show verification results; **do not publish automatically**.