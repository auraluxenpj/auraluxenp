import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { getRequestHeader } from '@tanstack/react-start/server';
import { callBizSathiInventory } from './bizsathi-inventory.server';
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const inputSchema = z.object({
  orderNumber: z.string().trim().min(4).max(40),
  contact: z.string().trim().min(5).max(255),
});

export type TrackedOrderItem = { product_name: string; quantity: number };
export type TrackedOrder = {
  order_number: string;
  status: string;
  payment_status: string;
  tracking_number: string | null;
  created_at: string;
  total: number;
  items: TrackedOrderItem[];
};

// Public order tracking: the database function only returns a limited,
// non-sensitive summary when BOTH the order number and the matching phone
// number or email are supplied.
export const trackOrder = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<TrackedOrder | null> => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const db = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    const { data: result, error } = await db.rpc("track_order", {
      p_order_number: data.orderNumber,
      p_contact: data.contact,
    });
    if (error) throw new Error("Tracking is unavailable right now — please try again shortly.");
    return (result as TrackedOrder | null) ?? null;
  });


const statusInputSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum(['confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned']),
  trackingNumber: z.string().trim().max(160).nullable().optional(),
});

type OrderStatusRow = {
  id: string;
  status: string;
  checkout_key: string;
  inventory_operation_id: string | null;
};

export const updateOrderStatus = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => statusInputSchema.parse(input))
  .handler(async ({ data }) => {
    const url = process.env['SUPABASE_URL'];
    const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
    if (!url || !key) throw new Error('Store database is not configured');
    const authHeader = getRequestHeader('authorization');
    const client = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: authHeader ? { Authorization: authHeader } : {} },
    });
    // Authorize before any cross-system stock mutation. RLS on the later
    // orders UPDATE is not sufficient: BizSathi must never be committed or
    // cancelled for a customer who can only read their own order.
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!bearerToken) throw new Error('Administrator access required');
    const { data: authData, error: authError } = await client.auth.getUser(bearerToken);
    if (authError || !authData.user) throw new Error('Administrator access required');
    const { data: isAdmin, error: roleError } = await client.rpc('has_role', {
      _user_id: authData.user.id,
      _role: 'admin',
    });
    if (roleError || isAdmin !== true) throw new Error('Administrator access required');

    const db = client as unknown as {
      from: (table: string) => {
        select: (columns: string) => {
          eq: (column: string, value: string) => {
            single: () => Promise<{ data: OrderStatusRow | null; error: { message: string } | null }>;
          };
        };
        update: (values: Record<string, unknown>) => {
          eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
        };
      };
    };
    const { data: authorityEnabled, error: authorityError } = await client.rpc('website_inventory_authority_enabled');
    if (authorityError) throw new Error('Could not verify the inventory authority setting');
    const { data: order, error: readError } = await db.from('orders')
      .select('id,status,checkout_key,inventory_operation_id')
      .eq('id', data.orderId)
      .single();
    if (readError || !order) throw new Error('Order not found or access denied');

    if (authorityEnabled === true && order.inventory_operation_id && order.status === 'pending' && !['confirmed', 'cancelled'].includes(data.status)) {
      throw new Error('A pending order must be confirmed or cancelled before fulfilment status can advance.');
    }
    if (authorityEnabled === true && !order.inventory_operation_id && order.status === 'pending') {
      throw new Error('This pre-integration order needs stock reconciliation in BizSathi before its status can change.');
    }
    if (order.inventory_operation_id && data.status === 'returned') {
      throw new Error('Process the returned stock in BizSathi before marking this order as returned.');
    }
    if (order.inventory_operation_id && (data.status === 'confirmed' || data.status === 'cancelled')) {
      const action = data.status === 'confirmed' ? 'commit' : 'cancel';
      try {
        await callBizSathiInventory({
          action,
          operationId: order.inventory_operation_id,
          reference: order.id,
        });
      } catch {
        const status = await callBizSathiInventory({
          action: 'status',
          operationId: order.inventory_operation_id,
        }).catch(() => null);
        const expected = data.status === 'confirmed' ? 'committed' : 'cancelled';
        if (!status || !('status' in status) || status.status !== expected) {
          throw new Error('BizSathi could not confirm the inventory operation. The order status was not changed.');
        }
      }
    }

    const patch: Record<string, unknown> = { status: data.status };
    if (data.trackingNumber !== undefined) patch.tracking_number = data.trackingNumber;
    const { error: updateError } = await db.from('orders').update(patch).eq('id', data.orderId);
    if (updateError) throw new Error(updateError.message || 'Order status update failed');
    return { success: true };
  });


const acceptReturnInputSchema = z.object({
  orderId: z.string().uuid(),
  items: z.array(z.object({
    orderItemId: z.string().uuid(),
    quantity: z.number().int().min(0).max(99),
    restockQuantity: z.number().int().min(0).max(99),
  }).strict()).min(1).max(50),
}).strict();

type ReturnOrderRow = { id: string; status: string; inventory_operation_id: string | null };
type ReturnOrderItemRow = { id: string; source_sku: string | null; quantity: number };

export const acceptOrderReturn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => acceptReturnInputSchema.parse(input))
  .handler(async ({ data }) => {
    const url = process.env['SUPABASE_URL'];
    const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
    if (!url || !key) throw new Error('Store database is not configured');
    const authHeader = getRequestHeader('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!bearerToken) throw new Error('Administrator access required');
    const client = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authHeader! } },
    });
    const { data: authData, error: authError } = await client.auth.getUser(bearerToken);
    if (authError || !authData.user) throw new Error('Administrator access required');
    const { data: isAdmin, error: roleError } = await client.rpc('has_role', {
      _user_id: authData.user.id,
      _role: 'admin',
    });
    if (roleError || isAdmin !== true) throw new Error('Administrator access required');

    type QueryResult<T> = { data: T | null; error: { message: string } | null };
    type ReturnDb = {
      from: (table: string) => {
        select: (columns: string) => {
          eq: (column: string, value: string) => {
            single: () => Promise<QueryResult<unknown>>;
          };
        };
        update: (values: Record<string, unknown>) => {
          eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
        };
      };
    };
    const db = client as unknown as ReturnDb;
    const { data: orderValue, error: orderError } = await db.from('orders')
      .select('id,status,inventory_operation_id')
      .eq('id', data.orderId)
      .single();
    const order = orderValue as ReturnOrderRow | null;
    if (orderError || !order) throw new Error('Order not found or access denied');
    if (!['delivered', 'returned'].includes(order.status)) {
      throw new Error('Only delivered orders can be returned');
    }
    if (!order.inventory_operation_id) {
      throw new Error('This order has no verified BizSathi reservation. Reconcile it before accepting a return.');
    }

    const listDb = client as unknown as {
      from: (table: string) => {
        select: (columns: string) => {
          eq: (column: string, value: string) => Promise<QueryResult<unknown[]>>;
        };
      };
    };
    const listed = await listDb.from('order_items').select('id,source_sku,quantity').eq('order_id', data.orderId);
    if (listed.error || !listed.data) throw new Error('Could not verify the items in this order');
    const orderItems = listed.data as ReturnOrderItemRow[];
    return await submitReturn(orderItems, order, data, db);
  });

async function submitReturn(
  orderItems: ReturnOrderItemRow[],
  order: ReturnOrderRow,
  data: z.infer<typeof acceptReturnInputSchema>,
  db: {
    from: (table: string) => {
      update: (values: Record<string, unknown>) => {
        eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
      };
    };
  },
) {
  const selected = new Map(data.items.map((item) => [item.orderItemId, item]));
  if (selected.size !== data.items.length) throw new Error('Duplicate order item in return request');
  const totals = new Map<string, { quantity: number; restockQuantity: number }>();
  for (const line of orderItems) {
    const input = selected.get(line.id);
    if (!input) continue;
    if (input.quantity > line.quantity || input.restockQuantity > input.quantity) {
      throw new Error('Returned and restock quantities cannot exceed the purchased quantity');
    }
    if (input.quantity === 0) continue;
    const sku = line.source_sku?.trim();
    if (!sku) throw new Error('A returned item has no verified BizSathi SKU. Resolve its mapping before accepting the return.');
    const current = totals.get(sku) ?? { quantity: 0, restockQuantity: 0 };
    current.quantity += input.quantity;
    current.restockQuantity += input.restockQuantity;
    totals.set(sku, current);
  }
  if ([...selected.keys()].some((id) => !orderItems.some((line) => line.id === id))) {
    throw new Error('Return request contains an item that does not belong to this order');
  }
  if (totals.size === 0) throw new Error('Enter at least one returned item');
  const operationId = await deriveInventoryOperationId(`auraluxe:return:${order.id}`);
  await callBizSathiInventory({
    action: 'accept_return',
    operationId,
    reservationId: order.inventory_operation_id,
    reference: order.id,
    items: [...totals.entries()].map(([sku, quantities]) => ({
      sku,
      quantity: quantities.quantity,
      restockQuantity: quantities.restockQuantity,
    })),
  });
  const { error: updateError } = await db.from('orders').update({ status: 'returned' }).eq('id', order.id);
  if (updateError) throw new Error('BizSathi accepted the return, but the website order status could not be updated. Retry the same return quantities to complete reconciliation.');
  return { success: true };
}
