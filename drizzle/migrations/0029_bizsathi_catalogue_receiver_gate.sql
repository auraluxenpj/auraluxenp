-- 0029: keep the BizSathi catalogue receiver fail-closed until its receiver gate is enabled.
-- The GUC is only a transaction marker; require service_role as well so a browser
-- session cannot spoof the marker with set_config().
CREATE OR REPLACE FUNCTION public.guard_bizsathi_catalogue_receiver()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  IF current_setting('app.catalogue_sync_origin', true) = 'bizsathi' THEN
    IF coalesce(auth.role(), '') <> 'service_role' THEN
      RAISE EXCEPTION 'BizSathi catalogue receiver requires service authorization';
    END IF;
    IF NOT coalesce((SELECT catalogue_enabled FROM public.bizsathi_sync_control WHERE id=1), false) THEN
      RAISE EXCEPTION 'BizSathi catalogue receiver is disabled';
    END IF;
  END IF;
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION public.guard_bizsathi_catalogue_receiver() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_bizsathi_catalogue_receiver() TO service_role;

DROP TRIGGER IF EXISTS bizsathi_catalogue_receiver_gate_products ON public.products;
CREATE TRIGGER bizsathi_catalogue_receiver_gate_products
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.guard_bizsathi_catalogue_receiver();

DROP TRIGGER IF EXISTS bizsathi_catalogue_receiver_gate_variants ON public.product_variants;
CREATE TRIGGER bizsathi_catalogue_receiver_gate_variants
  BEFORE INSERT OR UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.guard_bizsathi_catalogue_receiver();

COMMENT ON FUNCTION public.guard_bizsathi_catalogue_receiver() IS
'Blocks BizSathi-origin catalogue writes unless the receiver switch is enabled and the caller is service_role.';
