import { describe, expect, it } from 'vitest';
import { inventoryHealth, type HealthProduct } from './inventory-health';

const product = (overrides: Partial<HealthProduct> = {}): HealthProduct => ({
  id: 'one', name: 'Kurti', sku: 'AL-K-1', stock: 1, sizes: ['S'], price: 100,
  sale_price: null, is_published: true, ...overrides,
});

describe('read-only inventory health rules', () => {
  it('flags overall stock 1 versus size-stock total 5', () => {
    const products = [product({ sku: 'AL-OTH-999' })];
    const variants = [{ product_id: 'one', size: 'S', stock: 2 }, { product_id: 'one', size: 'M', stock: 3 }];
    expect(inventoryHealth(products, variants).mismatches[0]?.sizeTotal).toBe(5);
    expect(products[0]?.stock).toBe(1);
  });
  it('does not flag matching totals or untracked products', () => {
    expect(inventoryHealth([product({ stock: 5 }), product({ id: 'two', sku: null })],
      [{ product_id: 'one', size: 'S', stock: 5 }, { product_id: 'two', size: null, stock: 9 }]).mismatches).toEqual([]);
  });
  it('groups duplicate SKUs regardless of publication, case or outside whitespace', () => {
    const result = inventoryHealth([product({ sku: 'AL-PW-678' }), product({ id: 'two', sku: ' al-pw-678 ', is_published: false }), product({ id: 'three', sku: null })], []);
    expect(result.duplicateSkus.map(group => group.map(p => p.id))).toEqual([['one', 'two']]);
  });
  it('flags only published products with zero effective price', () => {
    const result = inventoryHealth([product({ price: 0 }), product({ id: 'draft', price: 0, is_published: false }), product({ id: 'sale', price: 0, sale_price: 50 })], []);
    expect(result.zeroPrice.map(p => p.id)).toEqual(['one']);
  });
  it('counts products once when multiple flags apply', () => {
    expect(inventoryHealth([product({ price: 0 }), product({ id: 'two', price: 0 })],
      [{ product_id: 'one', size: 'S', stock: 5 }]).flaggedCount).toBe(2);
  });
});