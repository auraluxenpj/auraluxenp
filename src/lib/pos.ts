import type { Product, ProductVariant, Category } from './data';
import { stockForSize } from './size-stock';
export type PosCatalog = { products: Product[]; variants: ProductVariant[]; categories: Category[]; tax_rate: number };
export type PosLine = { product_id: string; size: string | null; color: string | null; quantity: number; discount: number };
export type PosCustomer = { id: string; name: string; phone: string; balance: number };
export type ReceiptItem = PosLine & { product_name: string; sku: string | null; unit_price: number; line_total: number };
export type PosReceipt = { id: string; receipt_number: string; created_at: string; operator_name: string; store: Record<string,string>; customer_name: string; customer_phone: string | null; items: ReceiptItem[]; subtotal: number; item_discount: number; cart_discount: number; tax_rate: number; tax: number; total: number; payment_method: string; tendered: number; change_due: number; outstanding: number };
export const money = (n: number) => Number(n).toLocaleString('en-NP', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const roundMoney = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export function posTotals(lines: { unit_price: number; quantity: number; discount: number }[], cartDiscount: number, taxRate: number) {
  if (!Number.isFinite(cartDiscount) || cartDiscount < 0 || !Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) throw new Error('Invalid discount or tax');
  let subtotal = 0, itemDiscount = 0;
  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 99 || !Number.isFinite(line.unit_price) || line.unit_price < 0 || !Number.isFinite(line.discount) || line.discount < 0 || line.discount > roundMoney(line.unit_price * line.quantity)) throw new Error('Invalid quantity or item discount');
    subtotal += roundMoney(line.unit_price * line.quantity); itemDiscount += line.discount;
  }
  subtotal = roundMoney(subtotal); itemDiscount = roundMoney(itemDiscount);
  if (cartDiscount > roundMoney(subtotal - itemDiscount)) throw new Error('Cart discount exceeds sale value');
  const tax = roundMoney((subtotal - itemDiscount - cartDiscount) * taxRate / 100);
  return { subtotal, itemDiscount, tax, total: roundMoney(subtotal - itemDiscount - cartDiscount + tax) };
}
export function posAvailable(product: Product, variants: ProductVariant[], size: string | null) {
  const rows = variants.filter(v => v.product_id === product.id && v.size != null);
  return rows.length ? Math.min(product.stock, size ? stockForSize(rows, size) : 0) : product.stock;
}
export function validatePosPayment(method: string, customerId: string | null, total: number, tendered: number, qrReady: boolean, confirmed: boolean) {
  if (!['cash','qr','credit'].includes(method)) throw new Error('Invalid payment method');
  if (method === 'credit' && !customerId) throw new Error('Credit requires a saved customer');
  if (method === 'cash' && (!Number.isFinite(tendered) || tendered < total)) throw new Error('Cash received is below the total');
  if (method === 'qr' && (!qrReady || !confirmed)) throw new Error('Confirm funds received in merchant account');
}
export function nepalDay(iso: string) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kathmandu', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date(iso)); }