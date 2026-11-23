# BizSathi ↔ Auraluxe integration contract

## Authority and release rules

- BizSathi is the sole inventory authority for the Auraluxe business and Nepalgunj branch.
- Auraluxe website stock is a display/cache value only. It must never be used to overwrite BizSathi stock.
- Every website product imported from BizSathi is created unpublished (is_published = false). Publishing remains a deliberate website-admin action.
- Existing website products must be reconciled by verified identity before any linking or overwrite. SKU suffixes, shared numbers, or approximate names are not identity proof.
- No initial stock push is permitted until the BizSathi opening balance has been reconciled against a physical count and the adjustment history.
- The legacy /api/public/inventory-sync protocol is not the new integration contract. Its ack and push actions must not be used for automatic stock posting.

## Catalogue identity

Use the exact SKU as the primary catalogue reconciliation key; attach immutable source IDs after a safe SKU match:

- A BizSathi variant SKU maps to exactly one Auraluxe product variant SKU.
- products.bizsathi_product_id identifies the BizSathi product after its SKU set resolves to one Auraluxe product.
- product_variants.bizsathi_variant_id identifies the BizSathi variant after its SKU is matched.
- order_items.bizsathi_product_id, order_items.bizsathi_variant_id and order_items.source_sku preserve the identity captured at checkout.

SKU comparison trims surrounding whitespace and is case-insensitive; the stored SKU text is not rewritten. No product-name, slug, suffix, size, or colour matching is performed. If an SKU matches multiple website products/variants, or an existing source-ID mapping conflicts with the SKU, the batch fails for manual review. If no SKU match and no existing source-ID mapping exists, a new unpublished draft product/variant may be created. A product with multiple variants must resolve all matched SKUs to the same Auraluxe product.

When an existing website product or variant is linked, its merchandising content is preserved: names, descriptions, images, category, price, SEO fields, size/colour, stock and publishing status are not overwritten by catalogue matching. New variants start at zero stock. Auraluxe product-level stock remains a display/cache value; BizSathi is the sole inventory authority.

## Order lifecycle and durable delivery

The staged bizsathi_inventory_outbox is a PII-minimized transactional outbox. It records mapped order-line creation and subsequent order/payment-state transitions in the same database transaction as the website write. The payload contains product/variant IDs, SKU, quantities and order references; it does not contain customer name, phone, address, email or payment credentials. Delivery state and retry metadata live in the outbox row so a worker can retry the same event idempotently.

This outbox is a foundation, not an activated stock writer. It must not be connected to a worker until the BizSathi side implements an idempotent reserve/commit/cancel/return API and the website checkout is changed to use a reserve-first saga. Cross-database transactions are not atomic: the intended sequence is reserve in BizSathi, place the website order, then commit the reservation; if website placement fails, cancel the reservation. Ambiguous outcomes must be queried by operation ID rather than blindly retried or released.

- Mapped products are blocked from online checkout by a fail-closed database switch until the reserve-first saga is deployed and explicitly enabled.
- Checkout must reserve stock in BizSathi before confirming the website order.
- Payment confirmation commits the reservation according to the agreed order/payment policy.
- Checkout failure cancels the reservation.
- Order cancellation releases only the matching uncommitted reservation.
- Returns are bounded by the original committed quantity and require an explicit return operation; a generic returned status is not sufficient evidence for partial quantities.
- Every operation has a stable UUID and canonical payload fingerprint. Repeated delivery of the same operation is a no-op; a changed payload under the same ID is rejected.
- BizSathi rejects insufficient stock atomically. A stale website cache never authorizes checkout.

## Rollout gates

1. Review and merge the BizSathi workspace-ID correction after CI.
2. Apply this additive website schema migration only after review; it does not import catalogue rows or alter stock.
3. Review the draft-only catalogue export/upsert implementation in BizSathi PR #178 and website PR #26; its current supported fields are product name, category, variant label, model code, SKU and selling price. Only one of 407 active BizSathi products has an image path, and all 407 active variant labels are Standard/STANDARD. Description, actual size and colour values are not present in the current source schema.
4. Reconcile the current website catalogue against BizSathi's active catalogue using exact SKU matching. The initial audit found zero exact SKU intersections; recheck the current live data before import. Ambiguous or conflicting SKU matches require manual review; product names and suffixes are never fallback identity keys.
5. Implement BizSathi reservation/commit/cancel/return RPCs and the website server-side checkout saga; only then enable the database checkout-reservation switch.
6. Implement the outbox worker, retry/dead-letter visibility, and reconciliation reports.
7. Test in isolated/staging databases, including duplicate requests, concurrent checkout, payment failure, cancellation, partial return, timeout after remote commit, and replay.
8. Only then activate the integration. Production stock sync and product publishing remain manual gates.

## Current non-goals

- No production migration application.
- No stock import, stock overwrite, or automatic stock adjustment.
- No automatic product publishing.
- Mapped-product online checkout remains disabled until the reserve-first flow is active.
- No use of customer personal data in the inventory event payload.
- No activation of the old Auraluxe-authoritative SHARED_INVENTORY.md proposal.
