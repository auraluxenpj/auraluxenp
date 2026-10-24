CREATE OR REPLACE FUNCTION public.get_khata_statement(p_customer_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin access required'; END IF;
 -- A single SQL statement provides one consistent snapshot for balances and history.
 SELECT jsonb_build_object('customer',jsonb_build_object('id',c.id,'name',c.name,'phone',c.phone,'balance',coalesce((SELECT sum(amount) FROM public.pos_credit_entries WHERE customer_id=c.id),0)-coalesce((SELECT sum(amount) FROM public.pos_repayments WHERE customer_id=c.id),0)),'sales',coalesce((SELECT jsonb_agg(s.receipt ORDER BY s.created_at,s.receipt_number) FROM public.pos_sales s WHERE s.customer_id=c.id),'[]'::jsonb),'repayments',coalesce((SELECT jsonb_agg(r.voucher ORDER BY r.created_at,r.voucher_number) FROM public.pos_repayments r WHERE r.customer_id=c.id),'[]'::jsonb)) INTO result FROM public.pos_customers c WHERE c.id=p_customer_id;
 IF result IS NULL THEN RAISE EXCEPTION 'Customer not found'; END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.get_khata_statement(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_khata_statement(uuid) TO authenticated;