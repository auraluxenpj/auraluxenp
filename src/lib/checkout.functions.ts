import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { isAllowedNewOrderMethod } from "./payment-settings";

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

    const { data: result, error } = await (client as any).rpc("place_order", {
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
    });
    if (error) {
      console.error("[checkout] place_order failed:", error.message);
      throw new Error(error.message || "We couldn't place your order. Please try again.");
    }
    return result as PlaceOrderResult;
  });
