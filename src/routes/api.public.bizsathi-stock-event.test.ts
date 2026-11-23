import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: { rpc: mocks.rpc } }));

import { Route } from './api.public.bizsathi-stock-event';

const SECRET = 'isolated-test-secret-with-more-than-24-chars';
const EVENT = {
  eventId: '11111111-1111-4111-8111-111111111111',
  sourceTable: 'stock_movements',
  sourceId: '22222222-2222-4222-8222-222222222222',
  businessId: 'c0f0ed15-97e4-4859-ac8f-a2d4e81f5b01',
  branchId: '33333333-3333-4333-8333-333333333333',
  sku: 'AL-STOCK-001',
  skuVersion: 1,
  delta: -1,
  bizsathiProductId: '44444444-4444-4444-8444-444444444444',
  bizsathiVariantId: '55555555-5555-4555-8555-555555555555',
  auraluxeProductId: '66666666-6666-4666-8666-666666666666',
  auraluxeVariantId: '77777777-7777-4777-8777-777777777777',
  occurredAt: '2026-11-23T08:00:00.000Z',
};
const post = (body: unknown, token: string | null = SECRET) => new Request('https://auraluxe.test/api/public/bizsathi-stock-event', {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body),
});
const handler = (Route as unknown as { options: { server: { handlers: { POST: (ctx: { request: Request }) => Promise<Response> } } } }).options.server.handlers.POST;
const invoke = (body: unknown, token: string | null = SECRET) => handler({ request: post(body, token) });

beforeEach(() => {
  process.env['WEBSITE_INVENTORY_SYNC_SECRET'] = SECRET;
  mocks.rpc.mockReset().mockResolvedValue({ data: { ok: true, duplicate: false }, error: null });
});
afterEach(() => {
  delete process.env['WEBSITE_INVENTORY_SYNC_SECRET'];
});

describe('Auraluxe BizSathi stock event receiver', () => {
  it('rejects unauthenticated requests before database access', async () => {
    const response = await invoke(EVENT, null);
    expect(response.status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('validates and applies a signed stock event through the idempotent RPC', async () => {
    const response = await invoke(EVENT);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, result: { ok: true, duplicate: false } });
    expect(mocks.rpc).toHaveBeenCalledWith('apply_bizsathi_stock_event', {
      _event_id: EVENT.eventId,
      _source_table: EVENT.sourceTable,
      _source_id: EVENT.sourceId,
      _bizsathi_product_id: EVENT.bizsathiProductId,
      _bizsathi_variant_id: EVENT.bizsathiVariantId,
      _auraluxe_product_id: EVENT.auraluxeProductId,
      _auraluxe_variant_id: EVENT.auraluxeVariantId,
      _sku: EVENT.sku,
      _sku_version: EVENT.skuVersion,
      _delta: EVENT.delta,
    });
  });

  it('returns a reconciliation conflict when the approved mapping or baseline is missing', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'Verified physical stock baseline and approved mapping are required' } });
    const response = await invoke(EVENT);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: 'Stock event requires reconciliation' });
  });

  it('rejects fractional stock quantities instead of rounding them', async () => {
    const response = await invoke({ ...EVENT, delta: -0.5 });
    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
