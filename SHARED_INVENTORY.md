# BizSathi-authoritative shared inventory

## Implementation status

**Implemented in feature branches; not activated.** The website branch now includes:

- A cutover switch, server-only reservation proof table, and service-role proof RPCs in migration `0020_bizsathi_inventory_authority.sql`. The switch is seeded disabled.
- Checkout server flow that reserves SKU quantities in BizSathi before creating an order, preserves guest checkout, registers a server-only proof, and leaves the reservation pending until confirmation.
- Order status handling that commits on confirmation and releases on pending-order cancellation. Pre-cutover pending orders are blocked for reconciliation after activation; committed orders cannot be cancelled as if their reservation were still open.
- Website POS reserve/commit integration using the POS request key as the idempotency key.
- A guarded website projection endpoint at `/api/public/bizsathi-inventory`. It accepts only service-authenticated SKU-level quantities, checks current website stock and pending acknowledgements, and uses compare-and-set stock updates.
- Database guards that block legacy website product/variant stock writes when BizSathi authority is enabled. The old checkout/POS stock checks and deductions are bypassed only under that explicit switch.
- The old `/api/public/inventory-sync` remains the legacy manual comparison/absolute-push protocol and must not be treated as the new transaction protocol.

BizSathi is the single source of truth for Auraluxe inventory. The Auraluxe website is a sales channel and availability projection. The BizSathi Nepalgunj branch is the fulfilment branch for this integration. No stock authority changes or live synchronization are enabled by this preparation.

## Authority and mapping contract

- BizSathi owns on-hand quantity, reservations, committed stock movements, purchase receipts, returns, and authorized adjustments.
- Website availability is a projection of BizSathi sellable stock. It is never an independent source of stock truth.
- SKU is the only product-mapping key. Each published website SKU must map one-to-one to exactly one active BizSathi variant SKU. No product-name, size, or colour matching is permitted. No automatic mapping is permitted.
- Mapping activation is an explicit reviewed admin action. Missing, duplicate, normalized-collision, inactive, or ambiguous SKUs are blocked and surfaced for reconciliation.
- Website stock is SKU-level. It does not promise size- or colour-specific availability.
- Website catalogue publication is separate from mapping and inventory activation. Unmapped products must not become orderable through the integration.

## Versioned protocol preparation

The current version 1 contract defines: `balances`, `movements`, `status`, `reserve`, `commit`, `cancel`, `receive`, and `return`. It rejects absolute stock pushes and caller-supplied actor/admin role fields.

Mutation requests carry an operation UUID, the linked branch UUID, and explicit mapping IDs. The server must verify the integration identity, branch binding, mapping state, and action permissions before calling privileged database functions. Browser-supplied roles or business IDs are never authorization.

The server must calculate a canonical request fingerprint and store it with the original result in the same transaction as each mutation. An identical retry returns the original result; reusing an operation ID with changed input fails. Unknown outcomes are resolved through `status` using the original operation ID.

## Required transaction semantics

1. **Website checkout:** create an atomic reservation in BizSathi before accepting the order. A reservation reduces sellable availability but does not yet create the permanent sale movement.
2. **Order confirmation:** commit that exact reservation once, creating the permanent stock-ledger movement. Repeated commit requests are idempotent.
3. **Cancellation:** release only that order's own reservation. A cancellation after commitment is a return workflow, not a reservation release.
4. **BizSathi POS:** use the same stock ledger and reservation/commit discipline where a sale can race with a website checkout. A POS sale must not write a separate shadow stock balance.
5. **Publication:** publish revised sellable quantities and a durable revision/cursor to the website after the BizSathi transaction commits. Retries must not create duplicate movements or regress a newer website revision.
6. **Returns:** reference the original committed sale and line; accepted return quantities cannot exceed sold quantity less prior returns. Stock is restored only after the return is accepted.
7. **Purchases and corrections:** purchase receipts and authorized stock corrections update the BizSathi ledger and then publish the resulting availability.
8. **Offline POS:** offline drafts do not reserve or decrement stock. Stock is committed only when the transaction is successfully posted online.
9. **Uncertain outcomes:** do not release a reservation or retry a financial posting when its outcome is unknown. Keep it pending and reconcile through the operation status and durable event log.
10. **Mismatches:** SKU mismatches, stale revisions, insufficient stock, duplicate events, and ambiguous transaction states are visible exceptions. Never auto-map, silently overwrite, or silently adjust quantities.

## Cross-system reliability and security

- The two databases do not share an atomic transaction. Use durable operation records, idempotency, outbox/inbox processing, bounded retries, and explicit reconciliation.
- A lost response is not evidence of failure. Resolve the original operation ID before creating another operation.
- Movement cursors must be commit-ordered or use a durable overlap/acknowledgement strategy. A plain sequence allocated before transaction commit can skip transactions that commit out of order.
- Keep integration credentials server-side only. Never expose service-role keys or shared secrets to browser code, logs, or user-visible output.
- Privileged database functions must enforce the fixed Auraluxe business and Nepalgunj branch, least privilege, mapping state, and service-to-service identity. They must not trust a caller-supplied tenant, actor, or role.
- Preserve append-only movement and acknowledgement evidence. Do not delete financial records to disguise partial failure.
- The legacy absolute stock-push endpoint must be disabled for any SKU once that SKU is activated under the transactional protocol, preventing two competing write paths.

## Known cutover blockers

- The previous live data review found 13 website products, all unpublished, with zero website variant rows; six had SKUs and seven did not. The six existing website SKUs did not match BizSathi SKUs at that review. These are not eligible for automatic mapping.
- BizSathi Auraluxe previously had 407 active products and 407 active variants with unique non-empty SKUs. A current cutover comparison is still required before activation.
- Previous website project checks reported catalogue-loading/backend health concerns. Verify current website database health before enabling checkout reservations or publishing quantities.
- Existing website checkout and POS functions still deduct website `products.stock` / `product_variants.stock`; admin inventory and restock paths also write those columns. They must be migrated to the BizSathi transaction flow or disabled for activated SKUs before cutover.
- BizSathi's existing manual website sync is not the transactional reservation protocol. Its old tenant binding was corrected in a Git-only migration, but that migration remains unapplied pending review.
- Do not assume the existing shared-secret configuration is matched or valid. Verify connection health without revealing the secret.
- Initial baseline sync requires a separate reviewed discrepancy report and explicit owner approval.

## Implementation checkpoints

1. Complete the BizSathi reservation/commit/cancel ledger and service-to-service identity model.
2. Implement website reservation-before-order checkout, idempotent confirmation/cancellation, and remove legacy stock writes for activated mappings.
3. Route BizSathi POS, purchase receipts, accepted returns, and authorized adjustments through the same stock ledger and publication outbox.
4. Add explicit SKU mapping/reconciliation administration and a durable movement consumer with revision checks.
5. Add automated unit, SQL security, concurrent oversell, lost-response, duplicate-delivery, cancellation, partial-return, and recovery tests.
6. Review migration history and fresh recovery evidence before any database migration.
7. Produce a cutover discrepancy report; only after separate approval apply migrations, configure secrets, deploy compatible code, baseline reviewed mappings, and activate live synchronization.

**Safety boundary:** This document and the protocol preparation are not authorization to apply database migrations, change secrets, deploy, publish products, write stock, or run a baseline sync.
