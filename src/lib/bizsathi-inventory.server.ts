import { supabaseAdmin } from '@/integrations/supabase/client.server';

type InventoryResponse = {
  operationId: string;
  status: 'reserved' | 'committed' | 'cancelled' | 'not_found';
  duplicate?: boolean;
  items?: Array<{ sku: string; quantity: number; onHand: number; reserved: number; available: number }>;
};

type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
};

function inventoryConfig() {
  const url = process.env['BIZSATHI_INVENTORY_API_URL'];
  const secret = process.env['WEBSITE_INVENTORY_SYNC_SECRET'];
  if (!url || !url.startsWith('https://') || !secret || secret.length < 24) {
    throw new Error('BizSathi inventory service is not configured');
  }
  return { url, secret };
}

export async function callBizSathiInventory(
  payload: Record<string, unknown>,
): Promise<InventoryResponse | { events: unknown[] }> {
  const { url, secret } = inventoryConfig();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
    redirect: 'error',
    signal: AbortSignal.timeout(8000),
  });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok || !result || typeof result !== 'object') {
    throw new Error(response.status === 409 ? 'BizSathi inventory conflict' : 'BizSathi inventory service unavailable');
  }
  return result as InventoryResponse | { events: unknown[] };
}

export async function deriveInventoryOperationId(key: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`auraluxe:website-inventory:${key}`));
  const bytes = new Uint8Array(digest).slice(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function registerWebsiteInventoryProof(
  operationId: string,
  sourceType: 'order' | 'pos',
  sourceKey: string,
): Promise<void> {
  const db = supabaseAdmin as unknown as RpcClient;
  const { error } = await db.rpc('register_website_inventory_proof', {
    _operation_id: operationId,
    _source_type: sourceType,
    _source_key: sourceKey,
  });
  if (error) throw new Error('Could not register inventory reservation proof');
}

export async function cancelWebsiteInventoryProof(operationId: string): Promise<void> {
  const db = supabaseAdmin as unknown as RpcClient;
  const { error } = await db.rpc('cancel_website_inventory_proof', { _operation_id: operationId });
  if (error) throw new Error('Could not cancel inventory reservation proof');
}

export function asInventoryRpcClient(value: unknown): RpcClient {
  return value as RpcClient;
}
