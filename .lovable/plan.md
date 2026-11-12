# Automatic shared stock: Auraluxe and BizSathi

## Outcome
Both apps use **Auraluxe's existing inventory as the authoritative stock balance**. Sales, receiving, returns and corrections update that balance through authorized operations, rather than periodically overwriting one app's quantities with the other's. BizSathi keeps its accounting and stock history; Auraluxe keeps its catalogue, orders, accounts and payment rules. Removed business tools stay removed from Auraluxe.

## 1. Safety and opening agreement
- Confirm a fresh database recovery point/export and required storage downloads, and verify a genuinely isolated test environment before stock-changing tests or live migrations.
- Select one BizSathi fulfilment branch and review explicit mappings to existing Auraluxe product/size IDs. Use stable IDs, not SKU alone, for subsequent transactions.
- Leave duplicate SKUs and questionable quantities unresolved until owner review. AL-PW-678 and AL-PW-685 cannot be guessed; AL-OTH-999 needs physical size/count confirmation. Preserve zero-price entries.
- Record owner-approved opening balances as a cutover snapshot, not fabricated historical movements. Block activation for unresolved mappings; do not silently substitute BizSathi counts.

## 2. Auraluxe inventory foundation
- Add private operation, reservation, item-mapping and append-only movement records, with explicit grants/RLS and inventory revisions. Present the exact migration for review before applying it.
- Every movement records its source, actor/integration, product/size, signed quantity, before/after balance, reference and operation ID.
- Repeated operation IDs with identical payloads return the original result; changed payloads are rejected. Multi-item operations succeed or fail together.
- Lock products and then sizes in consistent ID order; prevent negative available stock and derive tracked product totals from their size rows.
- Convert checkout, restocking, admin adjustments, product save, CSV import and other reachable stock writers to the shared transaction contract. Preserve size IDs on edits, reject stale form/import revisions and protect deletion or size removal with linked activity.
- Track bounded per-order-item restocking. Preserve historical restock evidence; unknown restoration quantities require review rather than guessing.
- Close direct stock-write bypasses only after every writer is converted. Preserve existing payment calculation, restrictions and historical orders.

## 3. Secure external operations
- Extend the existing authenticated server-to-server connection with balance reads, reserve/commit/cancel, receiving/returns and operation-status endpoints. Keep credentials server-side; restrict the integration to mapped items and its permitted operations.
- Auraluxe checkout checks available stock after external reservations. BizSathi must obtain a reservation before completing a stock-consuming sale; if authority is unreachable, do not approve a sale against cached stock.
- Give reservations explicit states and reviewable recovery. Do not release an uncertain sale automatically just because time elapsed; reconcile its durable status first.
- Retire absolute quantity pushes for activated items so the old manual sync cannot overwrite authoritative balances or double-post movements.

## 4. BizSathi changes — separate project required
This chat can inspect BizSathi but cannot edit or deploy it. Implement its part in the BizSathi project using the agreed API contract:
- Persist a pending operation before remote requests. Reserve stock, post the local sale with a unique operation reference, then commit the reservation; recover ambiguous failures by querying operation status, not sending a new operation.
- Record received authoritative movements once, using their IDs, without inventing invoices, payments or tax entries.
- Route branch receiving, returns, corrections and transfers involving the linked branch through the same authority; unrelated branch inventory stays local. Define mapped stock as whole garments; exclude incompatible fractional-unit items.
- Refresh displays automatically from versioned balance/movement reads. Use a durable cursor, deduplication, bounded retries and visible failed/pending states. Display refresh can be delayed; sale authorization cannot rely on it.
- Add an authenticated recovery job only after both sides' pending-state protocol exists. Keep financial posting and stock commitment reconcilable; they are not one cross-database transaction.

## 5. Verification and controlled activation
- In isolation, test simultaneous Auraluxe/BizSathi sales for the last unit, multi-size orders, sale/return overlap, stale edits/imports, duplicate and changed retries, network timeout after success, abandoned reservations, partial local posting, replayed movement delivery and missing mappings.
- Test anonymous/customer/staff restrictions, rollback after an item fails, tracked/untracked conversion, movement totals and bounded restocks.
- Exercise both apps signed in: sale in either → authoritative balance changes → other app reads the new balance; receiving and return flows likewise. Confirm no duplicate accounting entries.
- Review exact results and outstanding exceptions. Publish compatible code in both projects, verify fresh recovery evidence, then enable reviewed mappings in a controlled cutover. No automatic publication or live switch in this planning step.

## Technical approach
Additive schema and versioned APIs in the current TanStack Start/Lovable Cloud architecture. Auraluxe stock remains authoritative; BizSathi projections are versioned caches, not a second authority. A durable reservation/posting/reconciliation protocol handles the unavoidable cross-database boundary. Online checkout stays atomic locally. Background delivery improves freshness but is never the overselling safeguard.

## Current blockers
- Fresh recovery evidence and verified isolated testing are not supplied.
- Fulfilment branch, product/size mapping and disputed opening quantities need review.
- BizSathi changes must be made from its own project; full two-app activation cannot be completed from this chat alone.