import { describe, expect, it } from 'vitest';
import { isRetiredBusinessPage } from './retired-business-pages';

describe('removed business tools', () => {
  it('retires POS billing and its sales ledger', () => {
    expect(isRetiredBusinessPage('/admin/pos')).toBe(true);
    expect(isRetiredBusinessPage('/admin/pos/sales')).toBe(true);
  });
  it('retires Customer Khata and statements', () => {
    expect(isRetiredBusinessPage('/admin/khata')).toBe(true);
    expect(isRetiredBusinessPage('/admin/khata/customer-id')).toBe(true);
  });
  it('retires Expenses', () => {
    expect(isRetiredBusinessPage('/admin/expenses')).toBe(true);
  });
  it('retires Purchases, vendors and bill entry/details', () => {
    for (const path of ['/admin/purchases', '/admin/purchases/vendors', '/admin/purchases/new', '/admin/purchases/bill-id']) {
      expect(isRetiredBusinessPage(path)).toBe(true);
    }
  });
  it('keeps store management and customer accounts available', () => {
    for (const path of ['/admin', '/admin/orders', '/admin/products', '/admin/inventory', '/admin/inventory-health', '/admin/settings', '/account', '/auth', '/shop', '/admin/possible']) {
      expect(isRetiredBusinessPage(path)).toBe(false);
    }
  });
});