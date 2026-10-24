import {describe,it,expect} from 'vitest';
import {netCredit,repaymentRemaining,cashflow} from './business-ledgers';
describe('Business ledger rules',()=>{
 it('subtracts repayments from credit accrued',()=>expect(netCredit([1000,500],[300,200])).toBe(1000));
 it('allows partial payment',()=>expect(repaymentRemaining(1000,300)).toBe(700));
 it('allows full payment',()=>expect(repaymentRemaining(1000,1000)).toBe(0));
 it('rejects overpayment',()=>expect(()=>repaymentRemaining(1000,1001)).toThrow());
 it('rejects zero repayment',()=>expect(()=>repaymentRemaining(1000,0)).toThrow());
 it('rejects negative repayment',()=>expect(()=>repaymentRemaining(1000,-1)).toThrow());
 it('rejects sub-cent repayment',()=>expect(()=>repaymentRemaining(1000,0.001)).toThrow());
 it('uses cash sales plus cash recoveries minus cash expenses, excludes QR and Udharo',()=>expect(cashflow([{payment_method:'cash',total:850},{payment_method:'qr',total:2000},{payment_method:'credit',total:500}],[{payment_method:'cash',amount:300},{payment_method:'qr',amount:200}],[{payment_source:'cash',amount:150},{payment_source:'bank_qr',amount:1000}])).toBe(1000));
 it('allows negative daily cashflow',()=>expect(cashflow([],[],[{payment_source:'cash',amount:150}])).toBe(-150));
});