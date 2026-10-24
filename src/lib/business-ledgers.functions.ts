import {createServerFn} from '@tanstack/react-start';
import {z} from 'zod';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
import type {Json} from '@/integrations/supabase/types';
import type {PosCustomer} from './pos';
import {EXPENSE_CATEGORIES,type CustomerStatement,type RepaymentVoucher,type Expense,type DaySummary} from './business-ledgers';
const daySchema=z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const getKhataDirectory=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 const {data:allowed,error:roleError}=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});if(roleError||!allowed)throw new Error('Admin access required');
 const {data,error}=await context.supabase.rpc('get_pos_customer_balances');if(error)throw new Error(error.message);return data as unknown as PosCustomer[];
});
export const getCustomerStatement=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).inputValidator((input:unknown)=>z.object({id:z.string().uuid()}).parse(input)).handler(async({data,context})=>{
 const {data:statement,error}=await context.supabase.rpc('get_khata_statement',{p_customer_id:data.id});if(error)throw new Error(error.message);return statement as unknown as CustomerStatement;
});
export const recordRepayment=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((input:unknown)=>z.object({request_key:z.string().uuid(),customer_id:z.string().uuid(),amount:z.number().finite().positive().max(999999999),payment_method:z.enum(['cash','qr']),qr_confirmed:z.boolean()}).parse(input)).handler(async({data,context})=>{
 const {data:voucher,error}=await context.supabase.rpc('record_pos_repayment',{p_request:data as Json});if(error)throw new Error(error.message);return voucher as unknown as RepaymentVoucher;
});
export const recordExpense=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((input:unknown)=>z.object({request_key:z.string().uuid(),expense_date:daySchema,category:z.enum(EXPENSE_CATEGORIES),payment_source:z.enum(['cash','bank_qr']),amount:z.number().finite().positive().max(999999999),payee:z.string().trim().min(1).max(150),notes:z.string().max(1000),receipt_reference:z.string().max(300)}).parse(input)).handler(async({data,context})=>{
 const {data:id,error}=await context.supabase.rpc('record_business_expense',{p_request:data as Json});if(error)throw new Error(error.message);return id;
});
export const getExpensesDay=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).inputValidator((input:unknown)=>z.object({day:daySchema}).parse(input)).handler(async({data,context})=>{
 const {data:summary,error}=await context.supabase.rpc('get_business_day_summary',{p_date:data.day});if(error)throw new Error(error.message);
 const expenses:Expense[]=[];for(let offset=0;;offset+=500){const r=await context.supabase.from('business_expenses').select('id,expense_date,category,payment_source,amount,payee,notes,receipt_reference,created_at').eq('expense_date',data.day).order('created_at',{ascending:false}).order('id').range(offset,offset+499);if(r.error)throw new Error(r.error.message);expenses.push(...(r.data??[]));if((r.data?.length??0)<500)break;}
 return {summary:summary as unknown as DaySummary,expenses};
});