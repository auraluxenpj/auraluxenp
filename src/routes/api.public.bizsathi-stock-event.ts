import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

const MAX_BODY_BYTES = 32 * 1024;
const eventSchema = z.object({
  eventId: z.string().uuid(),
  sourceTable: z.enum(['stock_movements','commerce_stock_movements','website_inventory_movements','website_inventory_return_movements']),
  sourceId: z.string().uuid(),
  businessId: z.string().uuid(),
  branchId: z.string().uuid(),
  sku: z.string().trim().min(1).max(80),
  skuVersion: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  delta: z.number().int().min(-1_000_000).max(1_000_000).refine(v => v !== 0),
  bizsathiProductId: z.string().uuid(),
  bizsathiVariantId: z.string().uuid(),
  auraluxeProductId: z.string().uuid(),
  auraluxeVariantId: z.string().uuid(),
  occurredAt: z.string().datetime({ offset: true }),
}).strict();

type Db = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
};

function equalSecret(left: string, right: string): boolean {
  const a = new TextEncoder().encode(left), b = new TextEncoder().encode(right);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}
function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

export const Route = createFileRoute('/api/public/bizsathi-stock-event')({
  server: { handlers: { POST: async ({ request }) => {
    const expected = process.env['WEBSITE_INVENTORY_SYNC_SECRET'] ?? '';
    const authorization = request.headers.get('authorization') ?? '';
    const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (expected.length < 24 || !supplied || !equalSecret(supplied, expected)) return json({ error: 'Unauthorized' }, 401);

    const contentLength = Number(request.headers.get('content-length') ?? 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) return json({ error: 'Request too large' }, 413);
    let parsed: z.infer<typeof eventSchema>;
    try {
      const raw = await request.text();
      if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return json({ error: 'Request too large' }, 413);
      parsed = eventSchema.parse(JSON.parse(raw));
    } catch {
      return json({ error: 'Invalid stock event' }, 400);
    }
    if (parsed.businessId !== 'c0f0ed15-97e4-4859-ac8f-a2d4e81f5b01') return json({ error: 'Unknown source business' }, 400);

    try {
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      const db = supabaseAdmin as unknown as Db;
      const result = await db.rpc('apply_bizsathi_stock_event', {
        _event_id: parsed.eventId,
        _source_table: parsed.sourceTable,
        _source_id: parsed.sourceId,
        _bizsathi_product_id: parsed.bizsathiProductId,
        _bizsathi_variant_id: parsed.bizsathiVariantId,
        _auraluxe_product_id: parsed.auraluxeProductId,
        _auraluxe_variant_id: parsed.auraluxeVariantId,
        _sku: parsed.sku,
        _sku_version: parsed.skuVersion,
        _delta: parsed.delta,
      });
      if (result.error || !result.data || typeof result.data !== 'object') {
        const detail = result.error?.message ?? '';
        const status = /disabled/i.test(detail) ? 503 : /baseline|mapping|out-of-order|negative|reused/i.test(detail) ? 409 : 503;
        console.warn('[bizsathi-stock-event] event not applied', { eventId: parsed.eventId, status });
        return json({ error: status === 409 ? 'Stock event requires reconciliation' : 'Stock event service unavailable' }, status);
      }
      return json({ ok: true, result: result.data });
    } catch (error) {
      console.error('[bizsathi-stock-event] request failed', error);
      return json({ error: 'Stock event service unavailable' }, 503);
    }
  } } },
});
