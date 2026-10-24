import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { money, type PosReceipt as Receipt } from '@/lib/pos';
export function PosReceipt({receipt,onClose}:{receipt:Receipt|null;onClose:()=>void}) {
 if(!receipt) return null;
 function print(format:'thermal'|'a4') {
  const source=document.getElementById('pos-print-receipt'); if(!source)return;
  const root=document.createElement('div');root.id='pos-print-root';root.append(source.cloneNode(true));document.body.append(root);document.body.dataset['posPrint']=format;
  try { window.print(); } finally { root.remove();delete document.body.dataset['posPrint']; }
 }
 return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg pos-receipt-dialog"><DialogHeader className="pos-no-print"><DialogTitle>Receipt · {receipt.receipt_number}</DialogTitle></DialogHeader>
 <div className="flex gap-2 pos-no-print"><Button onClick={()=>print('thermal')}><Printer/>80 mm receipt</Button><Button variant="outline" onClick={()=>print('a4')}><Printer/>A4 receipt</Button></div>
 <article id="pos-print-receipt" className="space-y-4 border border-border bg-background p-5 text-sm">
 <header className="text-center"><h2 className="font-display text-3xl">{receipt.store['brand_name'] || 'AURALUXE'}</h2><p>{receipt.store['address']}</p><p>{receipt.store['phone']}</p><p>{receipt.store['email']}</p><p className="mt-3 font-semibold">SALES RECEIPT</p><p>{receipt.receipt_number}</p><p>{new Date(receipt.created_at).toLocaleString('en-NP',{timeZone:'Asia/Kathmandu'})}</p></header>
 <div className="border-y border-border py-2"><p>{receipt.customer_name}{receipt.customer_phone && ` · ${receipt.customer_phone}`}</p><p>Cashier: {receipt.operator_name}</p></div>
 <div className="space-y-3">{receipt.items.map((i,index)=><div key={index}><p className="font-medium">{i.product_name}</p><p className="text-xs text-muted-foreground">{[i.sku,i.size,i.color].filter(Boolean).join(' · ')}</p><div className="flex justify-between"><span>{i.quantity} × {money(i.unit_price)}</span><span>{money(i.line_total)}</span></div>{i.discount>0 && <p className="text-xs">Item discount: {money(i.discount)}</p>}</div>)}</div>
 <div className="space-y-1 border-t border-border pt-3">{[['Subtotal',receipt.subtotal],['Item discounts',-receipt.item_discount],['Cart discount',-receipt.cart_discount],[`Tax (${receipt.tax_rate}%)`,receipt.tax]].map(([label,value])=><div className="flex justify-between" key={String(label)}><span>{label}</span><span>{money(Number(value))}</span></div>)}<div className="flex justify-between border-t border-border pt-2 text-lg font-semibold"><span>Total ({receipt.store['currency'] || 'Rs.'})</span><span>{money(receipt.total)}</span></div></div>
 <div className="border-t border-border pt-2"><p>Payment: {receipt.payment_method==='credit'?'Credit / Udharo':receipt.payment_method==='qr'?'QR · receipt confirmed':'Cash'}</p>{receipt.payment_method==='cash' && <><p>Received: {money(receipt.tendered)}</p><p>Change: {money(receipt.change_due)}</p></>}{receipt.payment_method==='credit' && <p>Outstanding: {money(receipt.outstanding)}</p>}</div><p className="text-center">Thank you for shopping at Auraluxe.</p>
 </article></DialogContent></Dialog>;
}