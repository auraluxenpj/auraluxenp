import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

const MAX_BODY_BYTES = 1_000_000;
const itemSchema = z.object({
  product_id: z.string().uuid(),
  variant_id: z.string().uuid(),
  name: z.string().trim().max(200).optional().nullable(),
  category: z.string().trim().max(100).optional().nullable(),
  variant_name: z.string().trim().max(100).optional().nullable(),
  model_code: z.string().trim().max(64).optional().nullable(),
  sku: z.string().trim().min(1).max(80).regex(/^\\S+$/),
  unit: z.string().trim().max(30).optional().nullable(),
  sizes: z.array(z.string().trim().max(30)).max(30).optional(),
  qty: z.number().finite().min(0).optional(),
  purchase_price: z.number().finite().min(0).optional(),
  mrp: z.number().finite().min(0).optional(),
  selling_price: z.number().finite().min(0),
  wholesale_price: z.number().finite().min(0).optional(),
  reorder_level: z.number().finite().min(0).optional(),
  published: z.boolean().optional(),
  notes: z.string().max(2000).optional().nullable(),
  barcode: z.string().trim().max(80).optional().nullable(),
}).strict();
const schema = z.object({ items: z.array(itemSchema).min(1).max(500) }).strict();

type Db = { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };
function equal(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}
function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

export const Route = createFileRoute('/api/public/bizsathi-catalogue-reconcile')({
  server: { handlers: { POST: async ({ request }) => {
    const expected = process.env['WEBSITE_INVENTORY_SYNC_SECRET'] ?? '';
    const authorization = request.headers.get('authorization') ?? '';
    const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (expected.length < 24 || !supplied || !equal(expected, supplied)) return json({ error: 'Unauthorized' }, 401);
    const length = Number(request.headers.get('content-length') ?? 0);
    if (Number.isFinite(length) && length > MAX_BODY_BYTES) return json({ error: 'Request too large' }, 413);
    let parsed: z.infer<typeof schema>;
    try {
      const raw = await request.text();
      if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return json({ error: 'Request too large' }, 413);
      parsed = schema.parse(JSON.parse(raw));
    } catch {
      return json({ error: 'Invalid complete BizSathi catalogue snapshot' }, 400);
    }
    const seen = new Set<string>();
    for (const item of parsed.items) {
      const key = item.sku.toLowerCase();
      if (seen.has(key)) return json({ error: 'Duplicate SKU in complete snapshot' }, 400);
      seen.add(key);
    }
    try {
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      const db = supabaseAdmin as unknown as Db;
      // Pass the authoritative publication flag through unchanged. The database
      // receiver mirrors it while retaining Auraluxe-only website enrichment.
      const result = await db.rpc('reconcile_bizsathi_catalogue', { _items: parsed.items });
      if (result.error || !result.data || typeof result.data !== 'object') {
        console.error('[bizsathi-catalogue-reconcile] failed', result.error?.message ?? 'invalid RPC response');
        return json({ error: 'Catalogue reconciliation failed' }, 503);
      }
      return json({ result: result.data });
    } catch (error) {
      console.error('[bizsathi-catalogue-reconcile] unavailable', error);
      return json({ error: 'Catalogue reconciliation unavailable' }, 503);
    }
  } } },
});
