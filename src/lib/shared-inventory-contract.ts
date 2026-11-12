import { z } from 'zod';

// Versioned protocol preparation only. This module is not connected to live stock writers.
const uuid = z.string().uuid();
const quantity = z.number().int().min(1).max(1_000_000);
const reference = z.string().trim().min(1).max(160);
const mappingIds = z.array(uuid).min(1).max(100).superRefine((ids, ctx) => {
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: 'Duplicate item mapping' });
});
const items = z.array(z.object({ mappingId: uuid, quantity }).strict()).min(1).max(100)
  .superRefine((rows, ctx) => {
    if (new Set(rows.map(row => row.mappingId)).size !== rows.length) {
      ctx.addIssue({ code: 'custom', message: 'Duplicate item mapping' });
    }
  });
const reservation = { version: z.literal(1), operationId: uuid, branchId: uuid };

export const sharedInventoryRequest = z.discriminatedUnion('action', [
  z.object({ version: z.literal(1), action: z.literal('balances'), branchId: uuid, mappingIds }).strict(),
  z.object({ version: z.literal(1), action: z.literal('movements'), branchId: uuid, cursor: z.string().regex(/^(0|[1-9]\d{0,18})$/), limit: z.number().int().min(1).max(100) }).strict(),
  z.object({ version: z.literal(1), action: z.literal('status'), operationId: uuid, branchId: uuid }).strict(),
  z.object({ ...reservation, action: z.literal('reserve'), reference, items }).strict(),
  z.object({ ...reservation, action: z.literal('commit'), documentReference: reference }).strict(),
  z.object({ ...reservation, action: z.literal('cancel'), reason: reference }).strict(),
  z.object({ ...reservation, action: z.literal('receive'), reference, items }).strict(),
  z.object({ ...reservation, action: z.literal('return'), originalOperationId: uuid, reference, items }).strict(),
]);
export type SharedInventoryRequest = z.infer<typeof sharedInventoryRequest>;

/** A stable representation for server-side idempotency checks, scoped to the verified integration. */
export function canonicalInventoryRequest(integrationId: string, input: unknown): string {
  const identity = uuid.parse(integrationId);
  const request = sharedInventoryRequest.parse(input);
  const normalized: Record<string, unknown> = { ...request };
  if ('items' in request) normalized['items'] = [...request.items].sort((a, b) => a.mappingId.localeCompare(b.mappingId));
  if ('mappingIds' in request) normalized['mappingIds'] = [...request.mappingIds].sort();
  return JSON.stringify({ integrationId: identity, request: Object.fromEntries(Object.entries(normalized).sort(([a], [b]) => a.localeCompare(b))) });
}

export type ReservationState = 'reserved' | 'committed' | 'cancelled';

/** No time-driven transition: uncertain local posting must be reconciled, not silently released. */
export function reservationTransition(state: ReservationState, action: 'commit' | 'cancel'): ReservationState {
  if (state === 'reserved') return action === 'commit' ? 'committed' : 'cancelled';
  if ((state === 'committed' && action === 'commit') || (state === 'cancelled' && action === 'cancel')) return state;
  throw new Error('Reservation already finalized differently');
}

export function availableInventory(onHand: number, reserved: number): number {
  const count = z.number().int().min(0).max(1_000_000);
  count.parse(onHand);
  count.parse(reserved);
  if (reserved > onHand) throw new Error('Reserved stock exceeds on-hand stock');
  return onHand - reserved;
}

export function assertBoundedReturn(sold: number, alreadyReturned: number, requested: number): void {
  quantity.parse(sold);
  z.number().int().min(0).parse(alreadyReturned);
  quantity.parse(requested);
  if (alreadyReturned + requested > sold) throw new Error('Return exceeds original sold quantity');
}