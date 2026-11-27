import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const previewSchema = z.object({
  code: z.string().trim().max(60).nullable(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().min(1).max(99),
  })).min(1).max(50),
});

type PreviewResult = { valid: boolean; code: string | null; discount: number; message: string | null };

// Preview is read-only. Prices, coupon rules and eligibility are fetched from
// the database; place_order independently revalidates and recalculates at commit.
export const previewCoupon = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => previewSchema.parse(input))
  .handler(async ({ data }): Promise<PreviewResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const ids = [...new Set(data.items.map((item) => item.productId))];
    const [{ data: products, error: productError }, { data: coupons, error: couponError }] = await Promise.all([
      db.from("products").select("id,price,sale_price,category_id,is_published").in("id", ids),
      db.from("coupons").select("id,code,type,value,min_order,category_id,product_id,usage_limit,used_count,starts_at,ends_at,is_active,auto_apply").eq("is_active", true),
    ]);
    if (productError || !products || products.length !== ids.length || products.some((p: any) => !p.is_published)) {
      throw new Error("Could not verify the current cart prices");
    }
    if (couponError || !coupons) throw new Error("Could not check coupon availability");
    const productById = new Map(products.map((p: any) => [p.id, p]));
    const subtotal = data.items.reduce((sum, item) => {
      const p = productById.get(item.productId) as any;
      return sum + Number(p.sale_price && Number(p.sale_price) > 0 ? p.sale_price : p.price) * item.quantity;
    }, 0);
    const now = Date.now();
    const eligible = coupons.filter((c: any) =>
      c.type === "percent" &&
      Number(c.value) > 0 && Number(c.value) <= 100 &&
      (!c.starts_at || new Date(c.starts_at).getTime() <= now) &&
      (!c.ends_at || new Date(c.ends_at).getTime() >= now) &&
      (c.usage_limit == null || Number(c.used_count) < Number(c.usage_limit)) &&
      subtotal >= Number(c.min_order ?? 0) &&
      (!c.product_id || data.items.some((i) => i.productId === c.product_id)) &&
      (!c.category_id || data.items.some((i) => (productById.get(i.productId) as any)?.category_id === c.category_id))
    );
    const requested = data.code?.trim();
    const candidates = requested
      ? eligible.filter((c: any) => c.code.toUpperCase() === requested.toUpperCase())
      : eligible.filter((c: any) => c.auto_apply);
    if (requested && candidates.length === 0) {
      return { valid: false, code: null, discount: 0, message: "That coupon is invalid or does not apply to this order." };
    }
    if (!requested && candidates.length === 0) {
      return { valid: true, code: null, discount: 0, message: null };
    }
    const best = candidates
      .map((c: any) => ({ ...c, calculated: Math.min(subtotal, Math.round((subtotal * Number(c.value) + Number.EPSILON) * 100 / 10000) / 100) }))
      .sort((a: any, b: any) => b.calculated - a.calculated)[0];
    if (!best) return { valid: true, code: null, discount: 0, message: null };
    return { valid: true, code: String(best.code).toUpperCase(), discount: Number(best.calculated.toFixed(2)), message: null };
  });
