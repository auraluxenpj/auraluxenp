import { createFileRoute } from '@tanstack/react-router';

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
function equalSecret(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) d |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return d === 0;
}
export const Route = createFileRoute('/api/public/shared-media/assign')({
  server: { handlers: { POST: async ({ request }) => {
    const auth = request.headers.get('authorization') ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const secret = process.env['WEBSITE_INVENTORY_SYNC_SECRET'] ?? '';
    if (!token || /[\\s,]/.test(token) || secret.length < 24 || !equalSecret(token, secret)) {
      return json({ error: 'Unauthorized' }, 401);
    }
    let body: unknown;
    try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
    if (!body || typeof body !== 'object') return json({ error: 'Invalid request' }, 400);
    const input = body as Record<string, unknown>;
    const sku = typeof input.sku === 'string' ? input.sku.trim() : '';
    const assetId = typeof input.asset_id === 'string' ? input.asset_id : '';
    if (!sku || sku.length > 80 || !/^[0-9a-f-]{36}$/i.test(assetId)) return json({ error: 'SKU and media asset are required' }, 400);
    try {
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      const db = supabaseAdmin as any;
      const { data: asset, error: assetError } = await db.from('media_assets')
        .select('id,storage_path').eq('id', assetId).maybeSingle();
      if (assetError || !asset) return json({ error: 'Media asset not found' }, 404);
      const { data: publicUrl } = db.storage.from('product-images').getPublicUrl(asset.storage_path);
      const { data: rows, error } = await db.from('product_variants')
        .update({ image_url: publicUrl.publicUrl }).eq('sku', sku).select('id');
      if (error || !Array.isArray(rows) || rows.length !== 1) {
        return json({ error: 'SKU was not found uniquely in the Auraluxe catalogue' }, 409);
      }
      return json({ ok: true, sku, asset_id: asset.id, url: publicUrl.publicUrl });
    } catch { return json({ error: 'Media service unavailable' }, 503); }
  } } },
});
