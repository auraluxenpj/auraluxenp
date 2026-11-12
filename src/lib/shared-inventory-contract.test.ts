import { describe, expect, it } from 'vitest';
import { availableInventory, assertBoundedReturn, canonicalInventoryRequest, reservationTransition, sharedInventoryRequest } from './shared-inventory-contract';

const integrationId = '00000000-0000-4000-8000-000000000001';
const branchId = '00000000-0000-4000-8000-000000000002';
const operationId = '00000000-0000-4000-8000-000000000003';
const mappingA = '00000000-0000-4000-8000-000000000004';
const mappingB = '00000000-0000-4000-8000-000000000005';
const request = { version: 1, action: 'reserve', operationId, branchId, reference: 'Counter sale 42', items: [{ mappingId: mappingA, quantity: 2 }, { mappingId: mappingB, quantity: 1 }] };

describe('shared authoritative stock protocol preparation', () => {
  it('permits stable ID mappings without ambiguous SKU matching', () => {
    expect(sharedInventoryRequest.parse(request)).toEqual(request);
    expect(sharedInventoryRequest.safeParse({ ...request, items: [{ sku: 'AL-PW-678', quantity: 2 }] }).success).toBe(false);
  });
  it('makes an identical reordered request yield the same retry payload', () => {
    expect(canonicalInventoryRequest(integrationId, request)).toBe(canonicalInventoryRequest(integrationId, { ...request, items: [...request.items].reverse() }));
  });
  it('distinguishes changed quantities on a reused operation ID', () => {
    expect(canonicalInventoryRequest(integrationId, request)).not.toBe(canonicalInventoryRequest(integrationId, { ...request, items: [{ mappingId: mappingA, quantity: 3 }, { mappingId: mappingB, quantity: 1 }] }));
  });
  it('scopes retries to the verified integration and branch', () => {
    expect(canonicalInventoryRequest(integrationId, request)).not.toBe(canonicalInventoryRequest(mappingA, request));
    expect(canonicalInventoryRequest(integrationId, request)).not.toBe(canonicalInventoryRequest(integrationId, { ...request, branchId: mappingB }));
  });
  it('rejects duplicate mappings in one multi-item operation', () => {
    expect(sharedInventoryRequest.safeParse({ ...request, items: [request.items[0], request.items[0]] }).success).toBe(false);
  });
  it('rejects fractional, negative and zero garment quantities', () => {
    for (const quantity of [0, -1, 1.5, 1_000_001]) expect(sharedInventoryRequest.safeParse({ ...request, items: [{ mappingId: mappingA, quantity }] }).success).toBe(false);
  });
  it('rejects absolute stock pushes and caller-supplied authorization fields', () => {
    expect(sharedInventoryRequest.safeParse({ ...request, action: 'push', stock: 99 }).success).toBe(false);
    expect(sharedInventoryRequest.safeParse({ ...request, isAdmin: true }).success).toBe(false);
  });
  it('requires an original operation for bounded sale returns', () => {
    expect(sharedInventoryRequest.safeParse({ ...request, action: 'return' }).success).toBe(false);
    expect(sharedInventoryRequest.safeParse({ ...request, action: 'return', originalOperationId: mappingB }).success).toBe(true);
  });
  it('subtracts active reservations from available stock', () => {
    expect(availableInventory(5, 3)).toBe(2);
    expect(availableInventory(1, 1)).toBe(0);
    expect(() => availableInventory(1, 2)).toThrow();
  });
  it('commits or cancels a reservation with repeatable final states', () => {
    expect(reservationTransition('reserved', 'commit')).toBe('committed');
    expect(reservationTransition('committed', 'commit')).toBe('committed');
    expect(reservationTransition('reserved', 'cancel')).toBe('cancelled');
    expect(reservationTransition('cancelled', 'cancel')).toBe('cancelled');
  });
  it('prevents commitment after cancellation or cancellation after commitment', () => {
    expect(() => reservationTransition('committed', 'cancel')).toThrow();
    expect(() => reservationTransition('cancelled', 'commit')).toThrow();
  });
  it('bounds partial returns by the original sold quantity', () => {
    expect(() => assertBoundedReturn(5, 2, 3)).not.toThrow();
    expect(() => assertBoundedReturn(5, 2, 4)).toThrow();
  });
  it('limits movement reads and retains an exact string cursor', () => {
    const read = { version: 1, action: 'movements', branchId, cursor: '9007199254740993', limit: 100 };
    expect(sharedInventoryRequest.parse(read)).toEqual(read);
    expect(sharedInventoryRequest.safeParse({ ...read, limit: 101 }).success).toBe(false);
    expect(sharedInventoryRequest.safeParse({ ...read, cursor: '-1' }).success).toBe(false);
  });
});