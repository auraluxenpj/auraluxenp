# Shared inventory implementation status

## Prepared, not activated
`src/lib/shared-inventory-contract.ts` defines the proposed version 1 request validation and pure safety rules. No handler, migration, stock writer or job uses it yet. Tests verify protocol rules only; they do not establish database atomicity, durable retries, authorization or two-app behavior.

The existing `/api/public/inventory-sync` remains the manual legacy protocol. Do not point BizSathi at the proposed protocol until its endpoints, mappings and transaction changes have been tested and explicitly activated. No automatic stock link is enabled by this preparation.

## Authority and integration contract
- Auraluxe owns the authoritative on-hand and reserved balances. Its available count is on-hand minus active reservations. BizSathi caches those balances with revisions; cached stock never authorizes a sale.
- Version 1 actions: `balances`, `movements`, `status`, `reserve`, `commit`, `cancel`, `receive`, `return`. No absolute stock pushes or remotely supplied actor/admin role.
- Mutation requests carry an operation UUID, the linked branch UUID and explicit item mapping UUIDs. Scope keys by verified integration and action. Store a server-calculated fingerprint of the canonical payload and the original result in the same transaction as the mutation. Matching retries return that result; changed payloads fail.
- Verify integration identity server-side and enforce its linked branch, active mappings and per-action permission before calling privileged functions. Browser role fields are never accepted. The contract's schema validation is not authorization.
- Reservation line quantities are fixed at creation. Commit/cancel finalize that same reservation. Repeated identical finalization is safe; contradictory finalization fails. No automatic expiry may release an uncertain local financial posting.
- Returns must reference committed original sale lines and cannot exceed sold quantity less prior returns. This bound must be checked while locking original lines in the database, not only in TypeScript.
- Emit immutable movement IDs and sequence/cursor values from the same stock transaction. Movement reads use a safe durable commit-ordered cursor or overlap/ack scheme: a plain sequence allocated before transaction commit is insufficient because transactions can commit out of order.
- Replays must be deduplicated by movement ID in BizSathi. Lost responses are recovered by status using the original operation ID.
- Receiving retries are bounded by a reviewed receipt reference/operation. Corrections and mapping activation are separate admin-only actions with revision checks, not a generic integration stock-setting privilege.
- Preserve stable size IDs; lock products then variants in deterministic order. Tracked totals derive from colour-agnostic size rows. Route checkout and every stock writer through this contract before activation.

## Cross-app sale sequence
1. BizSathi persists a pending local operation with a retry key.
2. It reserves authoritative stock using that key and the reviewed mappings.
3. It posts its local financial document once, recording the reservation reference.
4. It commits the reservation and reconciles unknown responses via status. Local failure cancels only when posting is conclusively absent. Ambiguous outcomes stay pending for recovery.

The two databases do not share an atomic transaction. No financial record should be deleted to disguise a partial outcome. A durable recovery worker reconciles it. Background refresh updates displays but does not prevent overselling; authoritative reservations do.

## Evidence and blocking gates — November 12, 2026
- The existing environment baseline says preview and published app share the backend. Verified isolation and fresh recovery export/storage evidence are still required.
- Read-only migration-history inspection reports a core SQL hash mismatch, unmatched historical database row, and missing recorded rows for `0015_inventory_sync`/`0016_inventory_sync_push_guard`. The tool cannot safely auto-repair this history. Existing sync tables alone do not prove migration provenance or the exact live function definitions. Reconcile history before new schema application; do not replay these migrations blindly.
- Auraluxe sync state, acknowledgements and push log were all empty during the preceding read-only review.
- AL-PW-678 and AL-PW-685 have duplicate product SKUs. AL-OTH-999 has overall stock 1 versus size total 5. Both size-tracked products have zero size-row SKUs. Explicit mappings and reviewed opening quantities are required; do not auto-merge or auto-correct.
- BizSathi is accessible only as a read-only cross-project snapshot from this chat. Its code/database/deployment changes must run in the BizSathi project. Source checkout does not grant access to its live private records or settings.

## Next implementation checkpoints
1. Confirm fresh recovery and isolation; reconcile migration history with verified original definitions.
2. Present exact additive SQL for owner review, then apply in isolation using the migration tool.
3. Implement authoritative database operations, reservation-aware checkout, safe editors/import/restock and stock-writer access closure.
4. Wire authenticated versioned endpoints and admin mapping/movement/pending-operation views with legacy sync disabled for activated mappings.
5. Implement BizSathi's pending-state protocol and recovery from its project; configure matching credentials without copying or revealing secret values.
6. Run real two-app and concurrent transaction tests in isolation. Publish compatible snapshots only with owner approval; activate reviewed mappings after a fresh cutover snapshot.