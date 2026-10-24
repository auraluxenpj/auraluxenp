REVOKE ALL ON public.pos_customers, public.pos_sales, public.pos_sale_items, public.pos_credit_entries FROM anon, authenticated;
GRANT SELECT, INSERT ON public.pos_customers TO authenticated;
GRANT SELECT ON public.pos_sales, public.pos_sale_items, public.pos_credit_entries TO authenticated;
GRANT ALL ON public.pos_customers, public.pos_sales, public.pos_sale_items, public.pos_credit_entries TO service_role;
REVOKE ALL ON SEQUENCE public.pos_receipt_sequence FROM anon, authenticated;
GRANT ALL ON SEQUENCE public.pos_receipt_sequence TO service_role;