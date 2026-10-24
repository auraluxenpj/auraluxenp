import {roundMoney} from './pos';
export type Vendor={id:string;name:string;phone:string;email:string;address:string;notes:string};
export type PurchaseLine={description:string;quantity:number;unit_cost:number};
export type PurchasePayment={id:string;payment_date:string;amount:number;payment_source:string;reference:string;notes:string};
export type PurchaseBill={id:string;vendor_id:string;invoice_number:string;bill_date:string;due_date:string|null;vendor_snapshot:Record<string,string>;subtotal:number;discount:number;tax_rate:number;tax:number;total:number;paid:number;notes:string;bill_reference:string;items:(PurchaseLine&{line_total:number})[];payments:PurchasePayment[]};
export type PurchaseData={vendors:Vendor[];bills:PurchaseBill[]};
export function purchaseTotals(lines:PurchaseLine[],discount:number,taxRate:number){
 if(!lines.length||lines.some(l=>!l.description.trim()||!Number.isFinite(l.quantity)||l.quantity<=0||!Number.isFinite(l.unit_cost)||l.unit_cost<0))throw new Error('Enter valid bill lines');
 const subtotal=roundMoney(lines.reduce((n,l)=>n+roundMoney(l.quantity*l.unit_cost),0));
 if(!Number.isFinite(discount)||discount<0||discount>subtotal||!Number.isFinite(taxRate)||taxRate<0||taxRate>100)throw new Error('Invalid discount or tax');
 const tax=roundMoney((subtotal-discount)*taxRate/100),total=roundMoney(subtotal-discount+tax);return {subtotal,tax,total};
}
export function purchaseStatus(total:number,paid:number,due:string|null,today:string){if(roundMoney(total-paid)<=0)return 'Paid';if(due&&due<today)return 'Overdue';return paid>0?'Partially paid':'Unpaid';}
export function purchasePaymentRemaining(total:number,paid:number,amount:number){if(!Number.isFinite(amount)||amount<=0||amount!==roundMoney(amount)||amount>roundMoney(total-paid))throw new Error('Payment exceeds remaining balance or is invalid');return roundMoney(total-paid-amount);}