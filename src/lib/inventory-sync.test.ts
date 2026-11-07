import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticateSyncRequest, handleSyncRequest, syncRequest, type RpcClient } from './inventory-sync';

const SECRET = 'test-secret-with-more-than-24-characters';
const post = (body: unknown, token: string | null = SECRET) => new Request('https://shop.example/api/public/inventory-sync', { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const fakeDb = (data: unknown = [], error: { message: string } | null = null) => { const rpc = vi.fn(async (_fn: string, _args: Record<string, unknown>) => ({ data, error })); return { db: { rpc } as RpcClient, rpc }; };

describe('inventory sync endpoint', () => {
  beforeEach(() => { process.env['INVENTORY_SYNC_SECRET'] = SECRET; });
  afterEach(() => { delete process.env['INVENTORY_SYNC_SECRET']; });

  it('refuses requests without the secret, with a wrong secret, or when no secret is configured', async () => {
    expect((await authenticateSyncRequest(post({}, null)))?.status).toBe(401);
    expect((await authenticateSyncRequest(post({}, 'wrong-secret-wrong-secret-wrong')))?.status).toBe(401);
    expect(await authenticateSyncRequest(post({}))).toBeNull();
    delete process.env['INVENTORY_SYNC_SECRET'];
    expect((await authenticateSyncRequest(post({})))?.status).toBe(500);
    process.env['INVENTORY_SYNC_SECRET'] = 'short';
    expect((await authenticateSyncRequest(post({})))?.status).toBe(500);
  });
  it('never touches the database for an unauthorised or invalid request', async () => {
    const { db, rpc } = fakeDb();
    expect((await handleSyncRequest(post({ action: 'state', skus: ['A'] }, 'nope'), db)).status).toBe(401);
    expect((await handleSyncRequest(post('not json'), db)).status).toBe(400);
    expect((await handleSyncRequest(post({ action: 'push', items: [{ sku: 'A', stock: -1, expected: 0 }] }), db)).status).toBe(400);
    expect((await handleSyncRequest(post({ action: 'state', skus: ['has space'] }), db)).status).toBe(400);
    expect((await handleSyncRequest(post({ action: 'delete' }), db)).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('maps each action to its database function', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const cases: [object, string, Record<string, unknown>][] = [
      [{ action: 'state', skus: ['A1'] }, 'inv_sync_state', { _skus: ['A1'] }],
      [{ action: 'ack', skus: ['A1'] }, 'inv_sync_ack', { _skus: ['A1'] }],
      [{ action: 'recorded', ids: [id] }, 'inv_sync_recorded', { _ids: [id] }],
      [{ action: 'push', items: [{ sku: 'A1', stock: 5, expected: 7 }] }, 'inv_sync_push', { _items: [{ sku: 'A1', stock: 5, expected: 7 }] }],
    ];
    for (const [body, fn, args] of cases) {
      const { db, rpc } = fakeDb([{ ok: true }]);
      const res = await handleSyncRequest(post(body), db);
      expect(res.status).toBe(200);
      expect(rpc).toHaveBeenCalledWith(fn, args);
      expect(res.headers.get('cache-control')).toBe('no-store');
    }
  });
  it('hides database error details from the caller', async () => {
    const { db } = fakeDb(null, { message: 'relation inventory_sync_state does not exist' });
    const res = await handleSyncRequest(post({ action: 'state', skus: ['A1'] }), db);
    expect(res.status).toBe(500);
    expect(await res.text()).toBe('Sync failed');
  });
  it('caps list sizes', () => {
    expect(syncRequest.safeParse({ action: 'state', skus: Array.from({ length: 2001 }, (_, i) => `S${i}`) }).success).toBe(false);
    expect(syncRequest.safeParse({ action: 'state', skus: [] }).success).toBe(false);
  });
});
