export type HealthProduct = {
  id: string; name: string; sku: string | null; stock: number;
  sizes: string[]; price: number; sale_price: number | null; is_published: boolean;
};
export type HealthVariant = { product_id: string; size: string | null; stock: number };
export type StockMismatch = { product: HealthProduct; sizeTotal: number; sizes: { size: string; stock: number }[] };

const normalize = (value: string) => value.trim().toLowerCase();

export function inventoryHealth(products: HealthProduct[], variants: HealthVariant[]) {
  const byProduct = new Map<string, HealthVariant[]>();
  for (const variant of variants) {
    if (!variant.size?.trim()) continue;
    const rows = byProduct.get(variant.product_id) ?? [];
    rows.push(variant);
    byProduct.set(variant.product_id, rows);
  }
  const mismatches: StockMismatch[] = [];
  const skuGroups = new Map<string, HealthProduct[]>();
  for (const product of products) {
    const rows = byProduct.get(product.id);
    if (rows) {
      const sizeTotal = rows.reduce((sum, row) => sum + Number(row.stock), 0);
      if (Number(product.stock) !== sizeTotal) {
        const sizes = new Map<string, { size: string; stock: number }>();
        for (const row of rows) {
          if (!row.size) continue;
          const key = normalize(row.size);
          const entry = sizes.get(key) ?? { size: row.size.trim(), stock: 0 };
          entry.stock += Number(row.stock);
          sizes.set(key, entry);
        }
        mismatches.push({ product, sizeTotal, sizes: [...sizes.values()] });
      }
    }
    if (product.sku?.trim()) {
      const key = normalize(product.sku);
      const group = skuGroups.get(key) ?? [];
      group.push(product);
      skuGroups.set(key, group);
    }
  }
  const duplicateSkus = [...skuGroups.values()].filter(group => group.length > 1);
  const zeroPrice = products.filter(product => product.is_published &&
    (Number(product.sale_price) > 0 ? Number(product.sale_price) : Number(product.price)) === 0);
  const flaggedIds = new Set([
    ...mismatches.map(row => row.product.id), ...duplicateSkus.flat().map(row => row.id),
    ...zeroPrice.map(row => row.id),
  ]);
  return { mismatches, duplicateSkus, zeroPrice, flaggedCount: flaggedIds.size, productCount: products.length };
}