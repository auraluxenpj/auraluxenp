import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

const MAX_BODY_BYTES = 1_000_000;
const itemSchema = z.object({
  product_id: z.string().uuid(),
  variant_id: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().max(100),
  variant_name: z.string().trim().min(1).max(100),
  model_code: z.string().trim().min(1).max(64),
  sku: z.string().trim().min(1).max(80).regex(/^\S+$/),
  selling_price: z.number().finite().min(0).max(100_000_000),
}).strict();
const requestSchema = z.object({ items: z.array(itemSchema).min(1).max(500) }).strict();

type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
};

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

function constantTimeEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  let difference = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    difference |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return difference === 0;
}

export const Route = createFileRoute('/api/public/bizsathi-catalogue')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env['WEBSITE_INVENTORY_SYNC_SECRET'];
        const authorization = request.headers.get('authorization') ?? '';
        const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
        if (!expected || expected.length < 24 || !supplied || !constantTimeEqual(expected, supplied)) {
          return json({ error: 'Unauthorized' }, 401);
        }

        const contentLength = Number(request.headers.get('content-length') ?? 0);
        if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
          return json({ error: 'Request too large' }, 413);
        }

        let parsed: z.infer<typeof requestSchema>;
        try {
          const raw = await request.text();
          if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
            return json({ error: 'Request too large' }, 413);
          }
          parsed = requestSchema.parse(JSON.parse(raw));
        } catch {
          return json({ error: 'Invalid catalogue batch' }, 400);
        }

        const variants = new Set<string>();
        const skus = new Set<string>();
        for (const item of parsed.items) {
          const variantId = item.variant_id.toLowerCase();
          const sku = item.sku.toLowerCase();
          if (variants.has(variantId) || skus.has(sku)) {
            return json({ error: 'Duplicate variant identity or SKU in catalogue batch' }, 400);
          }
          variants.add(variantId);
          skus.add(sku);
        }

        try {
          const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
          const db = supabaseAdmin as unknown as RpcClient;
          const result = await db.rpc('upsert_bizsathi_catalogue_drafts', {
            _items: parsed.items,
          });
          if (result.error || !result.data || typeof result.data !== 'object') {
            console.error('[bizsathi-catalogue] draft import failed', result.error?.message ?? 'invalid RPC response');
            return json({ error: 'Catalogue import failed' }, 503);
          }
          return json({ result: result.data });
        } catch (error) {
          console.error('[bizsathi-catalogue] request failed', error);
          return json({ error: 'Catalogue import unavailable' }, 503);
        }
      },
    },
  },
});
