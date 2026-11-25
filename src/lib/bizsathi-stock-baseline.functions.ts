import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const rowsSchema = z.object({
  rows: z.array(z.object({
    sku: z.string().trim().min(1).max(80),
    quantity: z.number().int().min(0).max(1000000),
  })).min(1).max(25),
});

const COUNT_REFERENCE = "Aura Final Google Sheet – 25 November 2026";

export const registerAuraluxeStockBaselines = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => rowsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const { data: isAdmin, error: roleError } = await db.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError || !isAdmin) throw new Error("Auraluxe administrator access required");

    const seen = new Set<string>();
    for (const row of data.rows) {
      const normalized = row.sku.trim().toLowerCase();
      if (seen.has(normalized)) throw new Error(`Duplicate SKU in batch: ${row.sku}`);
      seen.add(normalized);
    }

    let processed = 0;
    let duplicates = 0;
    for (const row of data.rows) {
      const sku = row.sku.trim();
      const { data: variants, error: variantError } = await db
        .from("product_variants")
        .select("id, sku, bizsathi_variant_id, product_id")
        .eq("sku", sku)
        .limit(2);
      if (variantError) {
        return { ok: false, processed, duplicates, failedSku: sku, error: variantError.message };
      }
      if (!variants || variants.length !== 1 || !variants[0].bizsathi_variant_id) {
        return { ok: false, processed, duplicates, failedSku: sku, error: "SKU mapping is missing or ambiguous" };
      }

      const variant = variants[0];
      const { data: products, error: productError } = await db
        .from("products")
        .select("id, bizsathi_product_id")
        .eq("id", variant.product_id)
        .limit(2);
      if (productError) {
        return { ok: false, processed, duplicates, failedSku: sku, error: productError.message };
      }
      if (!products || products.length !== 1 || !products[0].bizsathi_product_id) {
        return { ok: false, processed, duplicates, failedSku: sku, error: "Product mapping is missing or ambiguous" };
      }

      const { data: result, error: baselineError } = await db.rpc("register_bizsathi_stock_baseline", {
        _bizsathi_product_id: products[0].bizsathi_product_id,
        _bizsathi_variant_id: variant.bizsathi_variant_id,
        _auraluxe_product_id: products[0].id,
        _auraluxe_variant_id: variant.id,
        _sku: sku,
        _quantity: row.quantity,
        _bizsathi_ledger_quantity: row.quantity,
        _verification_reference: COUNT_REFERENCE,
      });
      if (baselineError) {
        return { ok: false, processed, duplicates, failedSku: sku, error: baselineError.message };
      }
      processed += 1;
      if ((result as { duplicate?: boolean } | null)?.duplicate) duplicates += 1;
    }

    return { ok: true, processed, duplicates };
  });
