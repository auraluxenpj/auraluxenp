import {useState} from 'react';
import {useServerFn} from '@tanstack/react-start';
import {useQueryClient} from '@tanstack/react-query';
import {toast} from 'sonner';
import {Dialog,DialogContent,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {saveVendor} from '@/lib/purchases.functions';
import type {Vendor} from '@/lib/purchases';
export function VendorEditor({vendor,onClose}:{vendor:Vendor|null;onClose:()=>void}){
 const [name,setName]=useState(vendor?.name??''),[phone,setPhone]=useState(vendor?.phone??''),[email,setEmail]=useState(vendor?.email??''),[address,setAddress]=useState(vendor?.address??''),[notes,setNotes]=useState(vendor?.notes??''),[saving,setSaving]=useState(false),save=useServerFn(saveVendor),qc=useQueryClient();
 async function submit(){setSaving(true);try{await save({data:{id:vendor?.id??null,name,phone,email,address,notes}});await qc.invalidateQueries({queryKey:['purchases']});onClose();toast.success('Vendor saved');}catch(e){toast.error(e instanceof Error?e.message:'Could not save vendor');}finally{setSaving(false);}}
 return <Dialog open onOpenChange={o=>{if(!o&&!saving)onClose();}}><DialogContent><DialogHeader><DialogTitle>{vendor?'Edit vendor':'New vendor'}</DialogTitle></DialogHeader><fieldset disabled={saving} className="space-y-3">{[['vendor-name','Name / Business',name,setName,150],['vendor-phone','Phone',phone,setPhone,20],['vendor-email','Email (optional)',email,setEmail,150],['vendor-address','Address (optional)',address,setAddress,500],['vendor-notes','Notes (optional)',notes,setNotes,1000]].map(([id,label,value,set,max])=><div key={String(id)}><label htmlFor={String(id)}>{String(label)}</label><Input id={String(id)} value={String(value)} maxLength={Number(max)} onChange={e=>{if(typeof set==='function')set(e.target.value);}}/></div>)}</fieldset><Button disabled={saving||name.trim().length<2||phone.trim().length<7} onClick={submit}>{saving?'Saving…':'Save vendor'}</Button></DialogContent></Dialog>;
}