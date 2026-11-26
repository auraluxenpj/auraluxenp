import { createFileRoute } from '@tanstack/react-router';

const BIZSATHI_IMAGE_URL = 'https://bizsathi-migration.auraluxe26.workers.dev/api/public/auraluxe-product-image';
const SHARED_IMAGE_PREFIX = 'https://jsshaoucrjorbyuzagdr.supabase.co/storage/v1/object/public/product-images/';

function isSharedImageUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.origin === 'https://jsshaoucrjorbyuzagdr.supabase.co'
      && url.pathname.startsWith('/storage/v1/object/public/product-images/')
      && !url.pathname.split('/').some((segment) => segment === '..' || segment === '.')
      && /\\.(webp|jpe?g|png)$/i.test(url.pathname);
  } catch {
    return false;
  }
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

export const Route = createFileRoute('/api/public/bizsathi-product-image')({
  server: { handlers: { POST: async ({ request }) => {
    const authorization = request.headers.get('authorization') ?? '';
    const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!accessToken || accessToken.trim() !== accessToken || accessToken.includes(',')) return json({ error: 'Unauthorized' }, 401);

    let body: unknown;
    try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Invalid request' }, 400);
    const input = body as Record<string, unknown>;
    const productId = input['product_id'];
    const imageUrl = input['image_url'];
    if (Object.keys(input).some((key) => !['product_id', 'image_url'].includes(key))
      || typeof productId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(productId)
      || (imageUrl !== null && !isSharedImageUrl(imageUrl))) {
      return json({ error: 'Invalid product ID or shared image URL' }, 400);
    }

    try {
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
      if (userError || !userData.user) return json({ error: 'Unauthorized' }, 401);
      const { data: adminRole, error: roleError } = await supabaseAdmin.from('user_roles')
        .select('user_id').eq('user_id', userData.user.id).eq('role', 'admin').maybeSingle();
      if (roleError || !adminRole) return json({ error: 'Administrator access required' }, 403);

      const { data: product, error: productError } = await supabaseAdmin.from('products')
        .select('id,bizsathi_product_id')
        .eq('id', productId).maybeSingle();
      if (productError || !product) return json({ error: 'Auraluxe product not found' }, 404);
      const bizsathiProductId = product.bizsathi_product_id;
      if (typeof bizsathiProductId !== 'string' || !bizsathiProductId) {
        return json({ ok: true, synced: false, reason: 'product_not_mapped' });
      }

      const secret = process.env['WEBSITE_INVENTORY_SYNC_SECRET'] ?? '';
      if (secret.length < 24) return json({ error: 'BizSathi image sync is not configured' }, 503);
      const response = await fetch(BIZSATHI_IMAGE_URL, {
        method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ bizsathi_product_id: bizsathiProductId, image_url: imageUrl }),
      });
      if (response.status >= 300 && response.status < 400) {
        await response.body?.cancel();
        return json({ error: 'BizSathi image endpoint redirected; shared secret was not forwarded' }, 503);
      }
      const result = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!response.ok || result?.ok !== true) {
        console.error('[bizsathi-product-image] receiver rejected image', { status: response.status, error: result?.error });
        return json({ error: 'Auraluxe saved the image, but BizSathi did not confirm the update', synced: false }, 503);
      }
      return json({ ok: true, synced: true, bizsathi_product_id: bizsathiProductId });
    } catch (error) {
      console.error('[bizsathi-product-image] sync failed', error);
      return json({ error: 'BizSathi image sync unavailable', synced: false }, 503);
    }
  } } },
});
