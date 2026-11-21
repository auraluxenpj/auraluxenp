import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

const MAX_BODY_BYTES = 64 * 1024;
const itemSchema = z.object({
  sku: z.string().trim().min(1).max(64).regex(/^\S+$/),
  stock: z.number().int().min(0).max(1_000_000),
}).strict();
const requestSchema = z.object({ items: z.array(itemSchema).min(1).max(100) }).strict();

type InventoryRpcClient = {
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

function equalSecret(left: string, right: string): boolean {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

export const Route = createFileRoute('/api/public/bizsathi-inventory')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env['WEBSITE_INVENTORY_SYNC_SECRET'];
        const authorization = request.headers.get('authorization') ?? '';
        const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
        if (!expected || !supplied || !equalSecret(expected, supplied)) return json({ error: 'Unauthorized' }, 401);

        const length = Number(request.headers.get('content-length') ?? 0);
        if (Number.isFinite(length) && length > MAX_BODY_BYTES) return json({ error: 'Request too large' }, 413);
        let parsed: z.infer<typeof requestSchema>;
        try {
          const raw = await request.text();
          if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return json({ error: 'Request too large' }, 413);
          parsed = requestSchema.parse(JSON.parse(raw));
        } catch {
          return json({ error: 'Invalid inventory update' }, 400);
        }
        const normalized = new Set<string>();
        for (const item of parsed.items) {
          const key = item.sku.toLowerCase();
          if (normalized.has(key)) return json({ error: 'Duplicate SKU in inventory update' }, 400);
          normalized.add(key);
        }

        try {
          const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
          const db = supabaseAdmin as unknown as InventoryRpcClient;
          const authority = await db.rpc('website_inventory_authority_enabled', {});
          if (authority.error || authority.data !== true) return json({ error: 'BizSathi inventory authority is not enabled' }, 503);
          const state = await db.rpc('bizsathi_inventory_projection_state', { _skus: parsed.items.map((item) => item.sku) });
          if (state.error || !Array.isArray(state.data)) return json({ error: 'Could not verify current website stock' }, 503);
          const bySku = new Map<string, { match?: unknown; current?: unknown; pending?: unknown }>();
          for (const row of state.data) {
            if (row && typeof row === 'object' && 'sku' in row) {
              const value = row as { sku: string; match?: unknown; current?: unknown; pending?: unknown };
              bySku.set(value.sku.toLowerCase(), value);
            }
          }
          const mismatches: string[] = [];
          const pushItems: Array<{ sku: string; stock: number; expected: number }> = [];
          for (const item of parsed.items) {
            const current = bySku.get(item.sku.toLowerCase());
            if (!current || current.match !== 'product' || Number(current.pending ?? 0) !== 0
              || !Number.isInteger(Number(current.current)) || Number(current.current) < 0) {
              mismatches.push(item.sku);
              continue;
            }
            pushItems.push({ sku: item.sku, stock: item.stock, expected: Number(current.current) });
          }
          if (mismatches.length) return json({ ok: false, mismatches }, 409);

          const pushed = await db.rpc('bizsathi_inventory_project', { _items: pushItems });
          if (pushed.error || !Array.isArray(pushed.data)) return json({ error: 'Website stock projection update failed' }, 503);
          const results = pushed.data as Array<{ sku?: string; result?: string }>;
          const failed = results.filter((row) => row.result !== 'applied').map((row) => row.sku ?? 'unknown');
          if (failed.length || results.length !== pushItems.length) return json({ ok: false, mismatches: failed }, 409);
          return json({ ok: true, applied: results.length });
        } catch (error) {
          console.error('[bizsathi-inventory] projection update failed', error);
          return json({ error: 'Inventory projection unavailable' }, 503);
        }
      },
    },
  },
});
