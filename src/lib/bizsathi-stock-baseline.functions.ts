import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type DbError = { message: string };
type BaselineVariant = {
  id: string;
  sku: string;
  bizsathi_variant_id: string | null;
  product_id: string;
};
type BaselineProduct = { id: string; bizsathi_product_id: string | null };
type BaselineDb = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: DbError | null }>;
  from: (table: string) => {
    select: (columns: string) => {
      in: (column: string, values: string[]) => Promise<{ data: unknown[] | null; error: DbError | null }>;
    };
  };
};

const BASELINE_ROW_COUNT = 395;
const BASELINE_UNIT_COUNT = 1705;
// Keep each request comfortably below the Cloudflare Workers subrequest ceiling.
// The browser invokes this authenticated function once per batch.
const REGISTRATION_BATCH_SIZE = 10;
const REGISTRATION_BATCH_COUNT = Math.ceil(BASELINE_ROW_COUNT / REGISTRATION_BATCH_SIZE);

const rowsSchema = z.object({
  rows: z.array(z.object({
    sku: z.string().trim().min(1).max(80),
    quantity: z.number().int().min(0).max(1000000),
  })).length(BASELINE_ROW_COUNT),
  batchIndex: z.number().int().min(0).max(REGISTRATION_BATCH_COUNT - 1),
});

const COUNT_REFERENCE = "Aura Final Google Sheet – 25 November 2026";
const chunks = <T,>(items: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
};

export const registerAuraluxeStockBaselines = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => rowsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as BaselineDb;
    const { data: isAdmin, error: roleError } = await db.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError || isAdmin !== true) throw new Error("Auraluxe administrator access required");

    const seen = new Set<string>();
    let quantityTotal = 0;
    for (const row of data.rows) {
      const normalized = row.sku.trim().toLowerCase();
      if (seen.has(normalized)) throw new Error(`Duplicate SKU in count sheet: ${row.sku}`);
      seen.add(normalized);
      quantityTotal += row.quantity;
    }
    if (seen.size !== BASELINE_ROW_COUNT || quantityTotal !== BASELINE_UNIT_COUNT) {
      throw new Error("Count sheet must contain exactly 395 unique SKUs and 1,705 whole units");
    }

    const skuList = data.rows.map((row) => row.sku.trim());
    const variants: BaselineVariant[] = [];
    for (const batch of chunks(skuList, 100)) {
      const { data: found, error } = await db
        .from("product_variants")
        .select("id, sku, bizsathi_variant_id, product_id")
        .in("sku", batch);
      if (error) throw new Error(error.message);
      variants.push(...((found ?? []) as BaselineVariant[]));
    }
    if (variants.length !== BASELINE_ROW_COUNT) throw new Error("One or more SKUs are missing or ambiguous in Auraluxe");
    const variantBySku = new Map<string, BaselineVariant>();
    for (const variant of variants) {
      const key = variant.sku.trim().toLowerCase();
      if (variantBySku.has(key) || !variant.bizsathi_variant_id) {
        throw new Error(`Missing or duplicate BizSathi variant mapping: ${variant.sku}`);
      }
      variantBySku.set(key, variant);
    }

    const productIds = [...new Set(variants.map((variant) => variant.product_id))];
    const products: BaselineProduct[] = [];
    for (const batch of chunks(productIds, 100)) {
      const { data: found, error } = await db
        .from("products")
        .select("id, bizsathi_product_id")
        .in("id", batch);
      if (error) throw new Error(error.message);
      products.push(...((found ?? []) as BaselineProduct[]));
    }
    const productById = new Map<string, BaselineProduct>(products.map((product) => [product.id, product]));
    const registrations = data.rows.map((row) => {
      const sku = row.sku.trim();
      const variant = variantBySku.get(sku.toLowerCase());
      const product = variant ? productById.get(variant.product_id) : null;
      if (!variant || !product?.bizsathi_product_id) {
        throw new Error(`Missing BizSathi product/variant mapping for SKU ${sku}`);
      }
      return {
        sku,
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

    const start = data.batchIndex * REGISTRATION_BATCH_SIZE;
    const batch = registrations.slice(start, start + REGISTRATION_BATCH_SIZE);
    const results = await Promise.all(batch.map(async (registration) => {
      const { data: result, error } = await db.rpc("register_bizsathi_stock_baseline", registration.params);
      const duplicate = typeof result === "object" && result !== null && "duplicate" in result
        && result.duplicate === true;
      return { sku: registration.sku, duplicate, error: error?.message ?? null };
    }));
    const failed = results.find((result) => result.error);
    const processed = results.filter((result) => !result.error).length;
    const duplicates = results.filter((result) => !result.error && result.duplicate).length;
    if (failed) {
      return {
        ok: false,
        batchIndex: data.batchIndex,
        processed,
        duplicates,
        failedSku: failed.sku,
        error: failed.error,
      };
    }

    return {
      ok: true,
      batchIndex: data.batchIndex,
      processed,
      duplicates,
      completedBatches: data.batchIndex + 1,
      totalBatches: REGISTRATION_BATCH_COUNT,
    };
  });
