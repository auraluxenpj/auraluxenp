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
function decodeBase64(value: string): Uint8Array | null {
  try {
    const binary = atob(value);
    if (binary.length > 15 * 1024 * 1024) return null;
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch { return null; }
}

export const Route = createFileRoute('/api/public/shared-media')({
  server: { handlers: { POST: async ({ request }) => {
    const auth = request.headers.get('authorization') ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token || /[\s,]/.test(token)) return json({ error: 'Unauthorized' }, 401);
    const sharedSecret = process.env['WEBSITE_INVENTORY_SYNC_SECRET'] ?? '';
    let createdBy: string | null = null;
    if (!(sharedSecret.length >= 24 && equalSecret(token, sharedSecret))) {
      try {
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
        const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
        if (userError || !userData.user) return json({ error: 'Unauthorized' }, 401);
        const { data: isAdmin, error: roleError } = await supabaseAdmin.rpc('has_role', { _user_id: userData.user.id, _role: 'admin' });
        if (roleError || isAdmin !== true) return json({ error: 'Administrator access required' }, 403);
        createdBy = userData.user.id;
      } catch { return json({ error: 'Media service unavailable' }, 503); }
    }

    let body: unknown;
    try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
    if (!body || typeof body !== 'object') return json({ error: 'Invalid request' }, 400);
    const input = body as Record<string, unknown>;
    const mime = input.mime_type;
    const encoded = input.base64;
    if (typeof mime !== 'string' || !['image/webp','image/jpeg','image/png'].includes(mime)
      || typeof encoded !== 'string' || encoded.length > 21_000_000) return json({ error: 'Unsupported image or payload too large' }, 400);
    const bytes = decodeBase64(encoded);
    if (!bytes || bytes.byteLength === 0) return json({ error: 'Invalid image payload' }, 400);

    // Verify actual file signatures; never trust the caller's MIME type alone.
    const starts = (...values: number[]) => values.every((v, i) => bytes[i] === v);
    const valid = mime === 'image/jpeg' ? starts(0xff,0xd8,0xff)
      : mime === 'image/png' ? starts(0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a)
      : mime === 'image/webp' ? starts(0x52,0x49,0x46,0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
      : starts(0,0,0,0);
    if (!valid) return json({ error: 'Image content does not match its declared type' }, 400);

    try {
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,'0')).join('');
      const ext = mime === 'image/jpeg' ? 'jpg' : mime === 'image/png' ? 'png' : 'webp';
      const path = `${hash.slice(0,2)}/${hash}.${ext}`;
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      const db = supabaseAdmin as any;
      const found = await db.from('media_assets').select('id,storage_path,mime_type').eq('sha256', hash).maybeSingle();
      if (found.error) return json({ error: 'Media registry unavailable' }, 503);
      if (found.data) {
        const { data } = db.storage.from('product-images').getPublicUrl(found.data.storage_path);
        return json({ ok: true, asset_id: found.data.id, path: found.data.storage_path, url: data.publicUrl, deduplicated: true });
      }
      const upload = await db.storage.from('product-images').upload(path, bytes, { contentType: mime, upsert: true, cacheControl: '31536000' });
      if (upload.error) return json({ error: 'Image storage upload failed' }, 503);
      const inserted = await db.from('media_assets').insert({ sha256: hash, storage_path: path, mime_type: mime, byte_size: bytes.byteLength, created_by: createdBy }).select('id').single();
      if (inserted.error) {
        // Concurrent uploads may win the unique hash race. Re-read and return the winner.
        const retry = await db.from('media_assets').select('id,storage_path').eq('sha256', hash).maybeSingle();
        if (!retry.data) return json({ error: 'Media registry write failed' }, 503);
        const { data } = db.storage.from('product-images').getPublicUrl(retry.data.storage_path);
        return json({ ok: true, asset_id: retry.data.id, path: retry.data.storage_path, url: data.publicUrl, deduplicated: true });
      }
      const { data } = db.storage.from('product-images').getPublicUrl(path);
      return json({ ok: true, asset_id: inserted.data.id, path, url: data.publicUrl, deduplicated: false });
    } catch {
      return json({ error: 'Media service unavailable' }, 503);
    }
  } } },
});
