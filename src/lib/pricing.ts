type PriceFields = { price: number | string; sale_price: number | string | null };

export function hasDiscount(product: PriceFields): boolean {
  const sale = Number(product.sale_price);
  const regular = Number(product.price);
  return (
    product.sale_price != null &&
    Number.isFinite(sale) &&
    Number.isFinite(regular) &&
    sale > 0 &&
    regular > 0 &&
    sale < regular
  );
}

export function effectivePrice(product: PriceFields): number {
  return hasDiscount(product) ? Number(product.sale_price) : Number(product.price);
}
