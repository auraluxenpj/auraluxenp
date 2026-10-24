import {describe,it,expect} from 'vitest';
import {posTotals,validatePosPayment,posAvailable,nepalDay} from './pos';
import type {Product,ProductVariant} from './data';
describe('POS rules',()=>{
 it('calculates item/cart discounts then tax',()=>expect(posTotals([{unit_price:1000,quantity:2,discount:100}],200,13)).toEqual({subtotal:2000,itemDiscount:100,tax:221,total:1921}));
 it('rejects item discount over the item value',()=>expect(()=>posTotals([{unit_price:100,quantity:1,discount:101}],0,0)).toThrow());
 it('rejects cart discount over the discounted subtotal',()=>expect(()=>posTotals([{unit_price:100,quantity:1,discount:20}],81,0)).toThrow());
 it('rejects fractional quantity',()=>expect(()=>posTotals([{unit_price:100,quantity:1.5,discount:0}],0,0)).toThrow());
 it('requires a saved party for Udharo',()=>expect(()=>validatePosPayment('credit',null,100,0,false,false)).toThrow('saved customer'));
 it('allows a walk-in cash sale',()=>expect(()=>validatePosPayment('cash',null,100,100,false,false)).not.toThrow());
 it('rejects insufficient cash',()=>expect(()=>validatePosPayment('cash',null,100,99,false,false)).toThrow());
 it('requires QR merchant confirmation',()=>expect(()=>validatePosPayment('qr',null,100,0,true,false)).toThrow());
 it('rejects unconfigured QR',()=>expect(()=>validatePosPayment('qr',null,100,0,false,true)).toThrow());
 it('uses size stock and disables sold out sizes',()=>{const p={id:'p',stock:5} as Product;const v=[{product_id:'p',size:'S',color:null,stock:2},{product_id:'p',size:'M',color:null,stock:0}] as ProductVariant[];expect(posAvailable(p,v,'S')).toBe(2);expect(posAvailable(p,v,'M')).toBe(0);expect(posAvailable(p,[],null)).toBe(5);});
 it('uses Nepal-local dates for daily totals',()=>expect(nepalDay('2026-10-23T19:00:00Z')).toBe('2026-10-24'));
});