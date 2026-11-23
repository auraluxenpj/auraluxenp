import { createFileRoute } from '@tanstack/react-router';

const BUSINESS_ID = 'c0f0ed15-97e4-4859-ac8f-a2d4e81f5b01';
type Db = { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };

function equal(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

function targetUrl(): string {
  const raw = process.env['BIZSATHI_CATALOGUE_SYNC_URL']?.trim()
    || 'https://bizsathi-migration.auraluxe26.workers.dev/api/public/auraluxe-catalogue';
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.pathname !== '/api/public/auraluxe-catalogue' || url.username || url.password || url.search || url.hash) {
    throw new Error('BIZSATHI_CATALOGUE_SYNC_URL must be the final HTTPS catalogue API URL');
  }
  return url.toString();
}

export const Route = createFileRoute('/api/public/bizsathi-catalogue-publish')({
  server: { handlers: { POST: async ({ request }) => {
    const secret = process.env['WEBSITE_INVENTORY_SYNC_SECRET'] ?? '';
    const auth = request.headers.get('authorization') ?? '';
    const supplied = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (secret.length < 24 || !supplied || !equal(secret, supplied)) return json({ error: 'Unauthorized' }, 401);

    let body: unknown;
    try { body = await request.json(); } catch { return json({ error: 'Invalid request' }, 400); }
    if (!body || typeof body !== 'object' || !('action' in body) || body.action !== 'publish_outbox') return json({ error: 'Invalid action' }, 400);

    try {
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      const db = supabaseAdmin as unknown as Db;
      const lease = crypto.randomUUID();
      const claimed = await db.rpc('claim_bizsathi_catalogue_outbox', { _lease: lease, _limit: 25 });
      if (claimed.error || !Array.isArray(claimed.data)) return json({ error: 'Catalogue outbox unavailable' }, 503);
      const url = targetUrl();
      let delivered = 0;
      for (const raw of claimed.data) {
        if (!raw || typeof raw !== 'object' || !('id' in raw) || !('payload' in raw)) return json({ error: 'Invalid outbox event' }, 503);
        const id = Number(raw.id);
        const payload = raw.payload;
        if (!Number.isSafeInteger(id) || !payload || typeof payload !== 'object') return json({ error: 'Invalid outbox event' }, 503);
        try {
          const response = await fetch(url, {
            method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(12000),
            headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ items: [payload] }),
          });
          if (!response.ok) {
            await db.rpc('fail_bizsathi_catalogue_outbox', { _id: id, _lease: lease, _error: `BizSathi HTTP ${response.status}` });
            return json({ ok: false, delivered, blocked: true }, 503);
          }
          const ack = await db.rpc('ack_bizsathi_catalogue_outbox', { _id: id, _lease: lease });
          if (ack.error || ack.data !== true) return json({ ok: false, delivered, blocked: true }, 503);
          delivered += 1;
        } catch {
          await db.rpc('fail_bizsathi_catalogue_outbox', { _id: id, _lease: lease, _error: 'Network delivery failed' }).catch(() => undefined);
          return json({ ok: false, delivered, blocked: true }, 503);
        }
      }
      return json({ ok: true, delivered, blocked: false });
    } catch (error) {
      console.error('[bizsathi-catalogue-publish] failed', error);
      return json({ error: 'Catalogue publisher unavailable' }, 503);
    }
  } } },
});
