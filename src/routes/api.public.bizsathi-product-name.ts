import { createFileRoute } from '@tanstack/react-router';

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
function equalSecret(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) d |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return d === 0;
}
function targetUrl(): string {
  const raw = process.env['BIZSATHI_PRODUCT_NAME_SYNC_URL']?.trim()
    || 'https://bizsathinepal.app/api/public/auraluxe-product-name';
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.pathname !== '/api/public/auraluxe-product-name'
    || url.username || url.password || url.search || url.hash) {
    throw new Error('BIZSATHI_PRODUCT_NAME_SYNC_URL must be the final HTTPS name-only endpoint');
  }
  return url.toString();
}

export const Route = createFileRoute('/api/public/bizsathi-product-name')({
  server: { handlers: { POST: async ({ request }) => {
    const authorization = request.headers.get('authorization') ?? '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!token || /[\s,]/.test(token)) return json({ error: 'Unauthorized' }, 401);

    let body: unknown;
    try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Invalid request' }, 400);
    const input = body as Record<string, unknown>;
    if (Object.keys(input).some((key) => !['product_id', 'name'].includes(key))) return json({ error: 'Only product ID and name are accepted' }, 400);
    const productId = input['product_id'];
    const name = input['name'];
    if (typeof productId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(productId)
      || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 150 || /[\u0000-\u001f\u007f]/.test(name)) {
      return json({ error: 'Invalid product ID or name' }, 400);
    }

    try {
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
      if (userError || !userData.user) return json({ error: 'Unauthorized' }, 401);
      const { data: adminRole, error: roleError } = await supabaseAdmin.from('user_roles')
        .select('user_id').eq('user_id', userData.user.id).eq('role', 'admin').maybeSingle();
      if (roleError || !adminRole) return json({ error: 'Administrator access required' }, 403);

      const { data: product, error: productError } = await supabaseAdmin.from('products')
        .select('bizsathi_product_id').eq('id', productId).maybeSingle();
      if (productError) return json({ error: 'Product mapping unavailable' }, 503);
      if (!product?.bizsathi_product_id) return json({ ok: true, skipped: true, reason: 'Product is not mapped to BizSathi' });

      const secret = process.env['WEBSITE_INVENTORY_SYNC_SECRET'] ?? '';
      if (secret.length < 24) return json({ error: 'Name sync is not configured' }, 503);
      const response = await fetch(targetUrl(), {
        method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(12000),
        headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ auraluxe_product_id: productId, name: name.trim() }),
      });
      const remote = await response.json().catch(() => null) as { ok?: boolean; product_id?: string; name?: string } | null;
      if (!response.ok || !remote?.ok || remote.name !== name.trim()) {
        console.error('[bizsathi-product-name] BizSathi did not confirm the name update', { status: response.status });
        return json({ error: 'BizSathi did not confirm the product-name update' }, 503);
      }
      return json({ ok: true, synced: true, name: remote.name });
    } catch (error) {
      console.error('[bizsathi-product-name] sync failed', error);
      return json({ error: 'Product-name sync unavailable' }, 503);
    }
  } } },
});
