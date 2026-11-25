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

    const skuList = data.rows.map((row) => row.sku.trim());
    const { data: variants, error: variantError } = await db
      .from("product_variants")
      .select("id, sku, bizsathi_variant_id, product_id")
      .in("sku", skuList);
    if (variantError) throw new Error(variantError.message);
    if (!variants || variants.length !== data.rows.length) {
      throw new Error("One or more SKUs are missing or ambiguous in Auraluxe");
    }
    const variantBySku = new Map<string, any>();
    for (const variant of variants) {
      const key = String(variant.sku).trim().toLowerCase();
      if (variantBySku.has(key) || !variant.bizsathi_variant_id) {
        throw new Error(`Missing or duplicate BizSathi variant mapping: ${variant.sku}`);
      }
      variantBySku.set(key, variant);
    }

    const productIds = [...new Set(variants.map((variant: any) => variant.product_id))];
    const { data: products, error: productError } = await db
      .from("products")
      .select("id, bizsathi_product_id")
      .in("id", productIds);
    if (productError) throw new Error(productError.message);
    const productById = new Map((products ?? []).map((product: any) => [product.id, product]));
    const registrations = data.rows.map((row) => {
      const sku = row.sku.trim();
      const variant = variantBySku.get(sku.toLowerCase());
      const product = variant ? productById.get(variant.product_id) as any : null;
      if (!variant || !product?.bizsathi_product_id) {
        throw new Error(`Missing BizSathi product/variant mapping for SKU ${sku}`);
      }
      return {
        sku,
        quantity: row.quantity,
        params: {
          _bizsathi_product_id: product.bizsathi_product_id,
          _bizsathi_variant_id: variant.bizsathi_variant_id,
          _auraluxe_product_id: product.id,
          _auraluxe_variant_id: variant.id,
          _sku: sku,
          _quantity: row.quantity,
          _bizsathi_ledger_quantity: row.quantity,
          _verification_reference: COUNT_REFERENCE,
        },
      };
    });

    const results = await Promise.all(registrations.map(async (registration) => {
      const { data: result, error } = await db.rpc("register_bizsathi_stock_baseline", registration.params);
      return {
        sku: registration.sku,
        duplicate: (result as { duplicate?: boolean } | null)?.duplicate === true,
        error: error?.message ?? null,
      };
    }));
    const failed = results.find((result) => result.error);
    const processed = results.filter((result) => !result.error).length;
    const duplicates = results.filter((result) => !result.error && result.duplicate).length;
    return failed
      ? { ok: false, processed, duplicates, failedSku: failed.sku, error: failed.error }
      : { ok: true, processed, duplicates };
  });
