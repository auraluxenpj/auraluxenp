import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { Json } from '@/integrations/supabase/types';
import type { PosCatalog, PosReceipt, PosCustomer } from './pos';
import {
  callBizSathiInventory,
  cancelWebsiteInventoryProof,
  registerWebsiteInventoryProof,
} from './bizsathi-inventory.server';
export const getPosCatalog = createServerFn({ method:'GET' }).middleware([requireSupabaseAuth]).handler(async ({context}) => {
  const { data, error } = await context.supabase.rpc('get_pos_catalog'); if (error) throw new Error(error.message);
  const { data: authority, error: authorityError } = await context.supabase.rpc('website_inventory_authority_enabled');
  if (authorityError) throw new Error('Could not verify inventory authority');
  return { ...(data as unknown as PosCatalog), inventoryAuthorityEnabled: authority === true };
});
export const getPosCustomers = createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async ({context}) => {
  const {data,error}=await context.supabase.rpc('get_pos_customer_balances');if(error)throw new Error(error.message);return data as unknown as PosCustomer[];
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
  const {data:enabled,error:authorityError}=await context.supabase.rpc('website_inventory_authority_enabled');
  if(authorityError) throw new Error('Could not verify the inventory authority setting');
  const db=context.supabase as unknown as {
    from:(table:string)=>{
      select:(columns:string)=>{
        eq:(column:string,value:string)=>{
          maybeSingle:()=>Promise<{data:{id:string;receipt:unknown;inventory_operation_id:string|null}|null;error:{message:string}|null}>;
        };
      };
    };
  };
  if(enabled===true){
    const {data:existing,error:lookupError}=await db.from('pos_sales')
      .select('id,receipt,inventory_operation_id').eq('request_key',data.request_key).maybeSingle();
    if(lookupError) throw new Error('POS sale status is uncertain. Check the sales ledger before retrying.');
    if(existing){
      if(existing.inventory_operation_id){
        const status=await callBizSathiInventory({action:'status',operationId:existing.inventory_operation_id}).catch(()=>null);
        if(status&&'status' in status&&status.status==='reserved'){
          await callBizSathiInventory({action:'commit',operationId:existing.inventory_operation_id,reference:`POS-${data.request_key}-CONFIRMED`});
        }else if(!status||!('status' in status)||status.status!=='committed'){
          throw new Error('Existing POS sale has an unresolved BizSathi stock operation. It remains held for reconciliation.');
        }
      }
      return existing.receipt as unknown as PosReceipt;
    }
  }

  let reserved=false;
  if(enabled===true){
    const productIds=[...new Set(data.items.map(item=>item.product_id))];
    const {data:products,error:skuError}=await context.supabase.from('products').select('id,sku').in('id',productIds);
    if(skuError||!products||products.length!==productIds.length) throw new Error('Could not verify POS product SKUs');
    const skuByProduct=new Map(products.map(product=>[product.id,product.sku?.trim().toLowerCase()??'']));
    const quantities=new Map<string,number>(); const skuOwners=new Map<string,string>();
    for(const item of data.items){
      const sku=skuByProduct.get(item.product_id)??'';
      if(!sku) throw new Error('A POS item is missing its SKU. Map it in BizSathi before selling.');
      const owner=skuOwners.get(sku);
      if(owner&&owner!==item.product_id) throw new Error('Two POS products share the same SKU. Sale paused for SKU review.');
      skuOwners.set(sku,item.product_id); quantities.set(sku,(quantities.get(sku)??0)+item.quantity);
    }
    await callBizSathiInventory({action:'reserve',operationId:data.request_key,reference:`POS-${data.request_key}`,items:[...quantities].map(([sku,quantity])=>({sku,quantity}))});
    try{
      await registerWebsiteInventoryProof(data.request_key,'pos',data.request_key);
      reserved=true;
    }catch(error){
      await callBizSathiInventory({action:'cancel',operationId:data.request_key,reference:`POS-${data.request_key}-CANCELLED`}).catch(()=>undefined);
      throw error;
    }
  }

  const {data:id,error}=await context.supabase.rpc('complete_pos_sale',{p_request:data as Json});
  let saleId=id as string;
  if(error){
    if(reserved){
      const {data:existing,error:lookupError}=await db.from('pos_sales')
        .select('id,receipt,inventory_operation_id').eq('request_key',data.request_key).maybeSingle();
      if(lookupError) throw new Error('POS sale status is uncertain. The stock reservation remains safely held for reconciliation.');
      if(existing?.inventory_operation_id===data.request_key){
        saleId=existing.id;
      }else{
        if(!existing){
          try{
            await callBizSathiInventory({action:'cancel',operationId:data.request_key,reference:`POS-${data.request_key}-CANCELLED`});
            await cancelWebsiteInventoryProof(data.request_key);
          }catch{
            throw new Error('POS sale failed, but the inventory reservation could not be released. It remains reserved for review.');
          }
        }else{
          await callBizSathiInventory({action:'cancel',operationId:data.request_key,reference:`POS-${data.request_key}-CANCELLED`});
          await cancelWebsiteInventoryProof(data.request_key);
          return existing.receipt as unknown as PosReceipt;
        }
        throw new Error(error.message);
      }
    }else{
      throw new Error(error.message);
    }
  }
  if(reserved){
    try{
      await callBizSathiInventory({action:'commit',operationId:data.request_key,reference:`POS-${data.request_key}-CONFIRMED`});
    }catch{
      const status=await callBizSathiInventory({action:'status',operationId:data.request_key}).catch(()=>null);
      if(status&&'status' in status&&status.status==='reserved'){
        await callBizSathiInventory({action:'commit',operationId:data.request_key,reference:`POS-${data.request_key}-CONFIRMED`}).catch(()=>undefined);
      }
      const verified=await callBizSathiInventory({action:'status',operationId:data.request_key}).catch(()=>null);
      if(!verified||!('status' in verified)||verified.status!=='committed'){
        throw new Error('POS sale was saved, but BizSathi stock commit is pending. Retry this same sale; do not create a new sale.');
      }
    }
  }
  const {data:sale,error:readError}=await context.supabase.from('pos_sales').select('receipt').eq('id',saleId).single();
  if(readError) throw new Error('Sale saved; open the sales ledger to retrieve the receipt');
  return sale.receipt as unknown as PosReceipt;
});
export const getPosSales = createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).inputValidator((input:unknown)=>z.object({from:z.string().datetime(),to:z.string().datetime()}).parse(input)).handler(async ({data,context})=>{
  const {data:allowed,error:roleError} = await context.supabase.rpc('can_use_pos'); if(roleError || !allowed) throw new Error('POS access denied');
  const rows:PosReceipt[]=[];
  for(let offset=0;;offset+=500){ const {data:sales,error} = await context.supabase.from('pos_sales').select('receipt').gte('created_at',data.from).lt('created_at',data.to).order('created_at',{ascending:false}).range(offset,offset+499); if(error) throw new Error(error.message); rows.push(...(sales ?? []).map(s=>s.receipt as unknown as PosReceipt)); if((sales?.length ?? 0)<500) break; }
  return rows;
});