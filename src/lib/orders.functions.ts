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
    const { data: order, error: readError } = await db.from('orders')
      .select('id,status,checkout_key,inventory_operation_id')
      .eq('id', data.orderId)
      .single();
    if (readError || !order) throw new Error('Order not found or access denied');

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
