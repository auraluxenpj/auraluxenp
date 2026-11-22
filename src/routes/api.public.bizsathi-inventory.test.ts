import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: { rpc: mocks.rpc } }));

import { Route } from './api.public.bizsathi-inventory';

const SECRET = 'isolated-test-secret-with-more-than-24-chars';
const post = (body: unknown, token: string | null = SECRET) => new Request('https://auraluxe.test/api/public/bizsathi-inventory', {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body),
});
const handler = (Route as unknown as { options: { server: { handlers: { POST: (ctx: { request: Request }) => Promise<Response> } } } }).options.server.handlers.POST;
const invoke = (body: unknown, token: string | null = SECRET) => handler({ request: post(body, token) });

beforeEach(() => {
  process.env['WEBSITE_INVENTORY_SYNC_SECRET'] = SECRET;
  mocks.rpc.mockReset();
  mocks.rpc.mockImplementation(async (name: string) => {
    if (name === 'website_inventory_authority_enabled') return { data: true, error: null };
    if (name === 'bizsathi_inventory_projection_state') return {
      data: [{ sku: 'AL-KURTI-01', match: 'product', current: 3, pending: 0 }], error: null,
    };
    if (name === 'bizsathi_inventory_project') return { data: [{ sku: 'AL-KURTI-01', result: 'applied' }], error: null };
    return { data: null, error: null };
  });
});

afterEach(() => { delete process.env['WEBSITE_INVENTORY_SYNC_SECRET']; });

describe('Auraluxe BizSathi inventory projection contract', () => {
  it('rejects unauthenticated requests before calling Supabase', async () => {
    expect((await invoke({ items: [{ sku: 'AL-KURTI-01', stock: 4 }] }, null)).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('rejects invalid and duplicate SKU projections without database writes', async () => {
    expect((await invoke({ items: [{ sku: 'AL KURTI', stock: 4 }] })).status).toBe(400);
    expect((await invoke({ items: [{ sku: 'AL-KURTI-01', stock: 4 }, { sku: 'al-kurti-01', stock: 2 }] })).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('refuses stock projection while BizSathi authority is disabled', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: false, error: null });
    const response = await invoke({ items: [{ sku: 'AL-KURTI-01', stock: 4 }] });
    expect(response.status).toBe(503);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith('website_inventory_authority_enabled', {});
  });

  it('verifies SKU identity and expected current stock before applying a projection', async () => {
    const response = await invoke({ items: [{ sku: 'AL-KURTI-01', stock: 4 }] });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, applied: 1 });
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, 'bizsathi_inventory_projection_state', { _skus: ['AL-KURTI-01'] });
    expect(mocks.rpc).toHaveBeenNthCalledWith(3, 'bizsathi_inventory_project', {
      _items: [{ sku: 'AL-KURTI-01', stock: 4, expected: 3 }],
    });
  });

  it('fails closed when SKU matching or pending-operation checks fail', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({
      data: [{ sku: 'AL-KURTI-01', match: 'ambiguous', current: 3, pending: 0 }], error: null,
    });
    const response = await invoke({ items: [{ sku: 'AL-KURTI-01', stock: 4 }] });
    expect(response.status).toBe(409);
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });

  it('fails closed when an inventory update is pending', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({
      data: [{ sku: 'AL-KURTI-01', match: 'product', current: 3, pending: 1 }], error: null,
    });
    expect((await invoke({ items: [{ sku: 'AL-KURTI-01', stock: 4 }] })).status).toBe(409);
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });
});
