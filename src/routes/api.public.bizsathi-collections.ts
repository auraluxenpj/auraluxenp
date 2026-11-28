import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

const collectionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  collection_type: z.enum(['seasonal', 'occasion', 'custom']),
  description: z.string().max(500).nullable().optional(),
  is_active: z.boolean(),
  sort_order: z.number().int().min(0).max(10000),
  starts_at: z.string().datetime().nullable().optional(),
  ends_at: z.string().datetime().nullable().optional(),
  product_ids: z.array(z.string().uuid()).max(500),
}).strict().refine(v => !v.starts_at || !v.ends_at || new Date(v.ends_at) > new Date(v.starts_at), {
  message: 'End date must be after start date',
});
const payloadSchema = z.object({ collections: z.array(collectionSchema).max(100) }).strict();

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
function constantTimeEqual(left: string, right: string) {
  const a = new TextEncoder().encode(left), b = new TextEncoder().encode(right);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}
function authorized(request: Request) {
  const expected = process.env['WEBSITE_INVENTORY_SYNC_SECRET'] ?? '';
  const auth = request.headers.get('authorization') ?? '';
  const supplied = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return expected.length >= 24 && supplied.length > 0 && constantTimeEqual(expected, supplied);
}

export const Route = createFileRoute('/api/public/bizsathi-collections')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!authorized(request)) return json({ error: 'Unauthorized' }, 401);
        try {
          const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
          const db = supabaseAdmin as any;
          const [collections, products] = await Promise.all([
            db.from('storefront_collections').select('*').order('sort_order', { ascending: true }),
            db.from('products').select('id,name,sku,stock,is_published,images').eq('is_published', true).gt('stock', 0).order('name'),
          ]);
          if (collections.error || products.error) return json({ error: 'Could not load collections' }, 503);
          const assignments = await db.from('storefront_collection_products').select('collection_id,product_id,sort_order').order('sort_order');
          if (assignments.error) return json({ error: 'Could not load product assignments' }, 503);
          return json({ collections: (collections.data ?? []).map(c => ({
            ...c,
            product_ids: (assignments.data ?? []).filter(a => a.collection_id === c.id).map(a => a.product_id),
          })), products: products.data ?? [] });
        } catch {
          return json({ error: 'Collections service unavailable' }, 503);
        }
      },
      POST: async ({ request }) => {
        if (!authorized(request)) return json({ error: 'Unauthorized' }, 401);
        const length = Number(request.headers.get('content-length') ?? 0);
        if (Number.isFinite(length) && length > 500_000) return json({ error: 'Request too large' }, 413);
        try {
          const raw = await request.text();
          if (new TextEncoder().encode(raw).byteLength > 500_000) return json({ error: 'Request too large' }, 413);
          const parsed = payloadSchema.parse(JSON.parse(raw));
          const ids = new Set<string>();
          const slugs = new Set<string>();
          for (const c of parsed.collections) {
            if (ids.has(c.id) || slugs.has(c.slug)) return json({ error: 'Duplicate collection id or slug' }, 400);
            ids.add(c.id); slugs.add(c.slug);
          }
          const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
          const db = supabaseAdmin as any;
          const { data, error } = await db.rpc('replace_storefront_collections', { _collections: parsed.collections });
          if (error) {
            console.error('[bizsathi-collections] save failed', error.message);
            return json({ error: 'Could not save collections' }, 503);
          }
          return json({ result: data });
        } catch {
          return json({ error: 'Invalid collections payload' }, 400);
        }
      },
    },
  },
});
