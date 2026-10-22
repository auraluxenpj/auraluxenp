# Read-only baseline — 2026-10-22

Backend: existing Lovable Cloud, shared by preview and published app.

Payment settings: payment_methods=cod,bank_transfer; whatsapp=9779709039488; shipping_charge=150; free_shipping_threshold=3500; tax_percent=0.
No bank or QR settings were returned by the payment-settings inspection.
orders.payment_method default: 'cod'::text. Checkout falls back to cod, selects the first configured method and accepts browser-calculated monetary values. Order and item inserts are separate.

Legacy orders:

| ID | Number | Total | Items | Order fingerprint | Items fingerprint |
|---|---|---|---|---|---|
| 1d3fd10a-8e17-4378-9114-697eee1bd720 | AL-261003-YZX6M | 3744 | 1 | 8dbff8e83556cf41da4c3e75bc402b38 | 2783eefb610b8861ade5367543385533 |
| 853cbdeb-a78b-4675-a626-06a884fcbaa0 | AL-261003-VCZFG | 2600 | 1 | 5c29a6d68eba0c1db8d738358ef2603a | da3fda894d363d3b8395728eb0571cfe |

Both are pending, unpaid and cod. Fingerprints are comparison evidence, not backups.

Catalogue: 10 products, 8 categories, 0 variant records. Accounts: 1 confirmed account and 1 admin role. Storage: product-images private bucket, 293 objects, 10 MB limit; public read policy, admin-only writes. Product references: 8 signed links and 6 bundled images.

Backup inventory timestamp: unverified. Supported full database export: not started or downloaded. Storage backup: not downloaded. No live mutations made.

Owner approved the Phase 1 plan. Existing CSV automated tests: 3 passed on 2026-10-22. Latest inspected automatic build at 11:35:44 UTC: build OK. New checkout/payment/security tests have not run; no Phase 1 application or database implementation has been activated.

Owner reports both database export and storage downloads completed. Backup timestamp supplied verbatim: "Aura Data3:04:14 pm utc". Date is absent, so latest snapshot timestamp is not fully verified. No independent inventory/export/download verification is available from this chat. Require dated backup evidence before production activation. Merchant QR and bank instructions remain unavailable. Create the isolated implementation draft on the next turn so it starts from the saved baseline and approved plan; verify isolation before any database changes.