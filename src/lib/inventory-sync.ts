import { z } from 'zod';

// Server-to-server endpoint used by BizSathi to keep stock in step. It carries no user session, so every
// request must present the shared secret, and the database functions behind it only accept the service role.

const sku = z.string().min(1).max(64).regex(/^\S+$/, 'SKU cannot contain spaces');
const skus = z.array(sku).min(1).max(2000);

export const syncRequest = z.discriminatedUnion('action', [
  z.object({ action: z.literal('state'), skus }),
  z.object({ action: z.literal('ack'), skus }),
  z.object({ action: z.literal('recorded'), ids: z.array(z.string().uuid()).min(1).max(2000) }),
  z.object({ action: z.literal('push'), items: z.array(z.object({ sku, stock: z.number().int().min(0).max(1_000_000), expected: z.number().int().min(0).max(1_000_000) })).min(1).max(2000) }),
]);
export type SyncRequest = z.infer<typeof syncRequest>;

export const MAX_BODY_BYTES = 1_000_000;

/** Returns a Response to send back when the request is not allowed, or null when it is. */
export async function authenticateSyncRequest(request: Request): Promise<Response | null> {
  const secret = process.env['INVENTORY_SYNC_SECRET'];
  if (!secret || secret.length < 24) return new Response('Server configuration error', { status: 500 });
  const token = /^Bearer ([^\s,]+)$/.exec(request.headers.get('authorization') ?? '')?.[1];
  if (!token) return new Response('Unauthorized', { status: 401 });
  const { createHash, timingSafeEqual } = await import('node:crypto');
  const digest = (v: string) => createHash('sha256').update(v, 'utf8').digest();
  return timingSafeEqual(digest(token), digest(secret)) ? null : new Response('Unauthorized', { status: 401 });
}

export type RpcClient = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> };

/** Runs one validated request against the database functions. */
export async function runSync(db: RpcClient, req: SyncRequest): Promise<Record<string, unknown>> {
  const call = async (fn: string, args: Record<string, unknown>) => {
    const { data, error } = await db.rpc(fn, args);
    if (error) throw new Error(`Sync step failed: ${fn}`);
    return data;
  };
  switch (req.action) {
    case 'state': return { items: await call('inv_sync_state', { _skus: req.skus }) };
    case 'ack': return { acks: await call('inv_sync_ack', { _skus: req.skus }) };
    case 'recorded': return { count: await call('inv_sync_recorded', { _ids: req.ids }) };
    case 'push': return { results: await call('inv_sync_push', { _items: req.items }) };
  }
}

export async function handleSyncRequest(request: Request, db: RpcClient): Promise<Response> {
  const denied = await authenticateSyncRequest(request);
  if (denied) return denied;
  const length = Number(request.headers.get('content-length') ?? '0');
  if (length > MAX_BODY_BYTES) return new Response('Request too large', { status: 413 });
  let parsed: SyncRequest;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return new Response('Request too large', { status: 413 });
    parsed = syncRequest.parse(JSON.parse(text));
  } catch { return new Response('Invalid request', { status: 400 }); }
  try {
    return Response.json(await runSync(db, parsed), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Inventory sync failed', error instanceof Error ? error.message : 'unknown');
    return new Response('Sync failed', { status: 500 });
  }
}
