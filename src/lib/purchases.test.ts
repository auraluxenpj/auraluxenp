import {describe,it,expect} from 'vitest';
import {purchaseTotals,purchaseStatus,purchasePaymentRemaining} from './purchases';
describe('Purchase tracking',()=>{
 it('calculates item costs discount and tax',()=>expect(purchaseTotals([{description:'Fabric',quantity:2,unit_cost:1000}],100,13)).toEqual({subtotal:2000,tax:247,total:2147}));
 it('rejects discount greater than subtotal',()=>expect(()=>purchaseTotals([{description:'Item',quantity:1,unit_cost:100}],101,0)).toThrow());
 it('rejects nonpositive quantity',()=>expect(()=>purchaseTotals([{description:'Item',quantity:0,unit_cost:100}],0,0)).toThrow());
 it('reports unpaid bills',()=>expect(purchaseStatus(1000,0,null,'2026-10-24')).toBe('Unpaid'));
 it('reports partial payments',()=>expect(purchaseStatus(1000,300,null,'2026-10-24')).toBe('Partially paid'));
 it('reports paid bills even after due date',()=>expect(purchaseStatus(1000,1000,'2026-10-20','2026-10-24')).toBe('Paid'));
 it('reports overdue only after due date',()=>{expect(purchaseStatus(1000,0,'2026-10-23','2026-10-24')).toBe('Overdue');expect(purchaseStatus(1000,0,'2026-10-24','2026-10-24')).toBe('Unpaid');});
 it('allows partial and full payment',()=>{expect(purchasePaymentRemaining(1000,300,200)).toBe(500);expect(purchasePaymentRemaining(1000,300,700)).toBe(0);});
 it('rejects overpayment',()=>expect(()=>purchasePaymentRemaining(1000,300,701)).toThrow());
});