-- Harden public SECURITY DEFINER RPC grants and remove direct access to trigger helpers.
-- This migration is forward-only and preserves guest checkout/order tracking.

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT
    _user_id IS NOT NULL
    AND _role IS NOT NULL
    AND (
      _user_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.user_roles AS caller_admin
        WHERE caller_admin.user_id = auth.uid()
          AND caller_admin.role = 'admin'::public.app_role
      )
    )
    AND EXISTS (
      SELECT 1
      FROM public.user_roles AS target_role
      WHERE target_role.user_id = _user_id
        AND target_role.role = _role
    );
$function$;

-- has_role remains callable by anon because public product-read policies invoke it.
-- Its body now returns only the caller's own role or cross-user results for admins.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated, service_role;

-- POS gate is not a public RPC. POS table policies and RPCs use it for authenticated users.
REVOKE ALL ON FUNCTION public.can_use_pos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_use_pos() TO authenticated, service_role;

-- Authenticated POS/admin operations. Keep service_role for trusted server-side maintenance.
REVOKE ALL ON FUNCTION public.complete_pos_sale(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_pos_sale(jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_business_day_summary(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_business_day_summary(date) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_khata_statement(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_khata_statement(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_pos_catalog() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_pos_catalog() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_pos_customer_balances() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_pos_customer_balances() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_pos_qr() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_pos_qr() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_purchase_data(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_purchase_data(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.record_business_expense(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_business_expense(jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.record_pos_repayment(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_pos_repayment(jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.record_purchase_bill(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_purchase_bill(jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.record_purchase_payment(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_purchase_payment(jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.restock_order(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restock_order(uuid, jsonb) TO authenticated, service_role;

-- Guest checkout and order tracking are intentional public endpoints.
REVOKE ALL ON FUNCTION public.place_order(text, text, jsonb, jsonb, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.place_order(text, text, jsonb, jsonb, text) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.track_order(text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.track_order(text, text) TO anon, authenticated, service_role;

-- Inventory sync remains service_role-only and is not enabled for browser clients.
REVOKE ALL ON FUNCTION public.inv_sync_ack(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inv_sync_ack(text[]) TO service_role;

REVOKE ALL ON FUNCTION public.inv_sync_find(text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inv_sync_find(text, boolean) TO service_role;

REVOKE ALL ON FUNCTION public.inv_sync_push(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inv_sync_push(jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.inv_sync_recorded(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inv_sync_recorded(uuid[]) TO service_role;

REVOKE ALL ON FUNCTION public.inv_sync_state(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inv_sync_state(text[]) TO service_role;

-- Trigger functions are not intended to be invoked directly through PostgREST.
REVOKE ALL ON FUNCTION public.audit_payment_settings() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lock_pos_credit_customer() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_unsupported_payment_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

-- Pin search_path on the two invoker trigger helpers flagged by the advisor.
ALTER FUNCTION public.reject_unsupported_payment_insert() SET search_path = pg_catalog, public;
ALTER FUNCTION public.touch_updated_at() SET search_path = pg_catalog, public;
