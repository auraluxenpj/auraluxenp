# Auraluxe ↔ BizSathi inventory integration

## Authority and mapping

- BizSathi is the single source of truth for Auraluxe on-hand and reserved inventory.
- SKU is the only cross-system product mapping key. Do not match by product name, size, colour, title, or approximate text.
- Each website product SKU must map explicitly and one-to-one to one active BizSathi variant SKU.
- Website stock is represented at SKU level. Size/colour-level availability is intentionally out of scope.
- Missing, duplicate, ambiguous, inactive, or mismatched SKUs are blocked for activation and reported for manual correction.

## Transaction contract

1. Website checkout requests an atomic reservation in BizSathi.
2. Confirmed payment/order finalizes the reservation and posts one stock deduction.
3. Cancellation releases the exact reservation; it must not recreate stock for an already committed sale.
4. BizSathi POS sales use the same authoritative stock ledger.
5. BizSathi publishes the resulting available quantity to the website.
6. Returns increase stock only after acceptance and must reference the original committed sale.
7. Retries use stable operation IDs and canonical request fingerprints. A repeated identical request returns its original result; changed payloads under the same ID are rejected.
8. Unknown outcomes remain pending for reconciliation. Do not blindly retry financial or stock mutations.

## Safety boundaries

- Do not use the legacy absolute stock-push endpoint as the two-way integration.
- Do not perform a baseline stock overwrite until the owner has reviewed a complete SKU mapping and discrepancy report and separately approved activation.
- No automatic SKU assignment or product-name matching.
- No synthetic production orders, sales, returns, or stock adjustments.
- Production secrets are server-side only and must never be read into logs, source control, or chat.
- Git branches and automated tests are permitted; production database migrations, secret changes, live deployments, and stock activation require separate approval.
- Without an isolated website database, code tests do not constitute end-to-end transaction verification.

## Current known blockers

- Website catalogue currently has products without SKUs and existing SKUs that do not match BizSathi. Every website SKU needs owner-reviewed explicit mapping.
- The website has no separate staging database. Production must not be used as a test target.
- BizSathi's existing staging database is empty and cannot validate realistic mappings or inventory operations.
- Existing website checkout, admin inventory, POS, and restock paths still write website stock directly. They must be safely routed through the reservation contract before two-way activation.
- Existing migration history has reported inconsistencies. Inspect and reconcile it before applying any migration; do not replay historical migrations blindly.
