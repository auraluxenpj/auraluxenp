import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
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
