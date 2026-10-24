import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { Json } from '@/integrations/supabase/types';
import type { PosCatalog, PosReceipt, PosCustomer } from './pos';
export const getPosCatalog = createServerFn({ method:'GET' }).middleware([requireSupabaseAuth]).handler(async ({context}) => {
  const { data, error } = await context.supabase.rpc('get_pos_catalog'); if (error) throw new Error(error.message); return data as unknown as PosCatalog;
});
export const getPosCustomers = createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async ({context}) => {
  const {data: allowed, error: roleError} = await context.supabase.rpc('can_use_pos'); if(roleError || !allowed) throw new Error('POS access denied');
  const {data, error} = await context.supabase.from('pos_customers').select('id,name,phone').order('name'); if(error) throw new Error(error.message);
  const {data: entries, error: ledgerError} = await context.supabase.from('pos_credit_entries').select('customer_id,amount'); if(ledgerError) throw new Error(ledgerError.message);
  return (data ?? []).map(c => ({...c,balance:(entries ?? []).filter(e => e.customer_id === c.id).reduce((n,e)=>n+Number(e.amount),0)})) as PosCustomer[];
});
export const createPosCustomer = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((input:unknown)=>z.object({name:z.string().trim().min(2).max(100),phone:z.string().transform(v=>v.replace(/\D/g,'').replace(/^977(?=\d{10}$)/,'')).pipe(z.string().regex(/^\d{7,15}$/))}).parse(input)).handler(async ({data,context})=>{
  const {data: row,error} = await context.supabase.from('pos_customers').insert({...data,created_by:context.userId}).select('id,name,phone').single(); if(error) throw new Error(error.code==='23505'?'A customer with this phone already exists':error.message); return {...row,balance:0};
});
export const getPosQr = createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async ({context})=>{
  const {data,error} = await context.supabase.rpc('get_pos_qr'); if(error) throw new Error(error.message);
  const qr = data as {path?:string;merchant?:string;provider?:string} | null; if(!qr?.path) return null;
  const {supabaseAdmin} = await import('@/integrations/supabase/client.server');
  const {data:signed,error:signError} = await supabaseAdmin.storage.from('payment-qr').createSignedUrl(qr.path,600); if(signError) throw new Error('QR image unavailable'); return {url:signed.signedUrl,merchant:qr.merchant,provider:qr.provider};
});
const saleSchema = z.object({request_key:z.string().uuid(),customer_id:z.string().uuid().nullable(),payment_method:z.enum(['cash','qr','credit']),cart_discount:z.number().finite().min(0).max(999999999),tendered:z.number().finite().min(0).max(999999999),qr_confirmed:z.boolean(),items:z.array(z.object({product_id:z.string().uuid(),size:z.string().max(100).nullable(),color:z.string().max(100).nullable(),quantity:z.number().int().min(1).max(99),discount:z.number().finite().min(0).max(999999999)})).min(1).max(100)});
export const completePosSale = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((input:unknown)=>saleSchema.parse(input)).handler(async ({data,context})=>{
  const {data:id,error} = await context.supabase.rpc('complete_pos_sale',{p_request:data as Json}); if(error) throw new Error(error.message);
  const {data:sale,error:readError} = await context.supabase.from('pos_sales').select('receipt').eq('id',id).single(); if(readError) throw new Error('Sale saved; open the sales ledger to retrieve the receipt'); return sale.receipt as unknown as PosReceipt;
});
export const getPosSales = createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).inputValidator((input:unknown)=>z.object({from:z.string().datetime(),to:z.string().datetime()}).parse(input)).handler(async ({data,context})=>{
  const {data:allowed,error:roleError} = await context.supabase.rpc('can_use_pos'); if(roleError || !allowed) throw new Error('POS access denied');
  const rows:PosReceipt[]=[];
  for(let offset=0;;offset+=500){ const {data:sales,error} = await context.supabase.from('pos_sales').select('receipt').gte('created_at',data.from).lt('created_at',data.to).order('created_at',{ascending:false}).range(offset,offset+499); if(error) throw new Error(error.message); rows.push(...(sales ?? []).map(s=>s.receipt as unknown as PosReceipt)); if((sales?.length ?? 0)<500) break; }
  return rows;
});