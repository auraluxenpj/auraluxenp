import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { isAllowedNewOrderMethod } from "./payment-settings";
import {
  callBizSathiInventory,
  cancelWebsiteInventoryProof,
  deriveInventoryOperationId,
  registerWebsiteInventoryProof,
} from "./bizsathi-inventory.server";

const itemSchema = z.object({
  productId: z.string().uuid(),
  size: z.string().max(40).nullable(),
  color: z.string().max(40).nullable(),
  quantity: z.number().int().min(1).max(99),
});

const inputSchema = z.object({
  checkoutKey: z.string().min(16).max(128),
  paymentMethod: z.string(),
  coupon: z.string().trim().max(60).nullable(),
  customer: z.object({
    customer_name: z.string().trim().min(2).max(100),
    customer_phone: z.string().trim().min(7).max(20),
    customer_email: z.string().trim().max(255).nullable(),
    address: z.string().trim().min(4).max(300),
    city: z.string().trim().min(2).max(100),
    state: z.string().trim().max(100).nullable(),
    country: z.string().trim().min(2).max(100),
    postal_code: z.string().trim().max(20).nullable(),
    delivery_notes: z.string().trim().max(500).nullable(),
  }),
  items: z.array(itemSchema).min(1).max(50),
});

export type PlaceOrderResult = {
  order_id: string;
  order_number: string;
  total: number;
  payment_method: string;
  duplicate: boolean;
};

// Trusted checkout: the database function re-reads prices, stock, coupons and
// shipping from trusted records and writes order + items atomically. The
// browser never supplies prices, totals, discounts, roles or ownership.
export const placeOrder = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<PlaceOrderResult> => {
    if (!isAllowedNewOrderMethod(data.paymentMethod)) {
      throw new Error("That payment method is not available");
    }

    const url = process.env["SUPABASE_URL"]!;
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    // Forward the caller's bearer token when present so auth.uid() links the
    // order to the signed-in customer; guests check out anonymously.
    const authHeader = getRequestHeader("authorization");
    const client = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: authHeader ? { Authorization: authHeader } : {},
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    const db = client as unknown as {
      rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
      from: (table: string) => {
        select: (columns: string) => {
          in: (column: string, values: string[]) => Promise<{ data: Array<{ id: string; sku: string | null }> | null; error: { message: string } | null }>;
        };
      };
    };
    const { data: enabled, error: authorityError } = await db.rpc("website_inventory_authority_enabled");
    if (authorityError) throw new Error("Could not verify the inventory authority setting");
    const authorityEnabled = enabled === true;
    let inventoryOperationId: string | null = null;

    if (authorityEnabled) {
      inventoryOperationId = await deriveInventoryOperationId(data.checkoutKey);
      const productIds = [...new Set(data.items.map((item) => item.productId))];
      const { data: products, error: skuError } = await db.from("products").select("id,sku").in("id", productIds);
      if (skuError || !products || products.length !== productIds.length) {
        throw new Error("Could not verify product SKUs for inventory reservation");
      }
      const skuByProduct = new Map(products.map((product) => [product.id, product.sku?.trim() ?? ""]));
      const quantities = new Map<string, number>();
      const skuOwners = new Map<string, string>();
      for (const item of data.items) {
        const sku = skuByProduct.get(item.productId)?.toLowerCase() ?? "";
        if (!sku) throw new Error("A product is missing its SKU. Checkout is paused until it is mapped in BizSathi.");
        const owner = skuOwners.get(sku);
        if (owner && owner !== item.productId) throw new Error("Two website products share the same SKU. Checkout is paused for SKU review.");
        skuOwners.set(sku, item.productId);
        quantities.set(sku, (quantities.get(sku) ?? 0) + item.quantity);
      }
      const reservationItems = [...quantities.entries()].map(([sku, quantity]) => ({ sku, quantity }));
      await callBizSathiInventory({
        action: "reserve",
        operationId: inventoryOperationId,
        reference: data.checkoutKey,
        items: reservationItems,
      });
      try {
        await registerWebsiteInventoryProof(inventoryOperationId, "order", data.checkoutKey);
      } catch (proofError) {
        try {
          await callBizSathiInventory({
            action: "cancel",
            operationId: inventoryOperationId,
            reference: data.checkoutKey,
          });
        } catch {
          throw new Error("The inventory reservation was created but could not be released after an order setup error. It remains held for reconciliation.");
        }
        throw proofError;
      }
    }

    const { data: result, error } = await db.rpc("place_order", {
      p_checkout_key: data.checkoutKey,
      p_payment_method: data.paymentMethod,
      p_customer: data.customer,
      p_items: data.items.map((i) => ({
        product_id: i.productId,
        size: i.size,
        color: i.color,
        quantity: i.quantity,
      })),
      p_coupon: data.coupon,
      ...(authorityEnabled ? { p_inventory_operation_id: inventoryOperationId } : {}),
    });
    if (error) {
      console.error("[checkout] place_order failed:", error.message);
      if (authorityEnabled && inventoryOperationId) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const admin = supabaseAdmin as unknown as {
          from: (table: string) => {
            select: (columns: string) => {
              eq: (column: string, value: string) => {
                maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
              };
            };
          };
        };
        const lookup = await admin.from("orders")
          .select("id,order_number,total,payment_method,inventory_operation_id")
          .eq("checkout_key", data.checkoutKey)
          .maybeSingle();
        if (lookup.error) {
          throw new Error("Order status is uncertain. The stock reservation has been kept safely for reconciliation.");
        }
        if (lookup.data && lookup.data.inventory_operation_id === inventoryOperationId) {
          return {
            order_id: String(lookup.data.id),
            order_number: String(lookup.data.order_number),
            total: Number(lookup.data.total),
            payment_method: String(lookup.data.payment_method),
            duplicate: true,
          };
        }
        try {
          await callBizSathiInventory({
            action: "cancel",
            operationId: inventoryOperationId,
            reference: data.checkoutKey,
          });
          await cancelWebsiteInventoryProof(inventoryOperationId);
        } catch {
          throw new Error("Order creation failed, but the inventory reservation could not be released. It has been left safely reserved for review.");
        }
      }
      throw new Error(error.message || "We couldn't place your order. Please try again.");
    }
    return result as PlaceOrderResult;
  });
