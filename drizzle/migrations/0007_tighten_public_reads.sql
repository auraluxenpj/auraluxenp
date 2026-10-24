DROP POLICY IF EXISTS "categories public read" ON public.categories;
CREATE POLICY "categories public read" ON public.categories FOR SELECT TO anon, authenticated
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "banners public read" ON public.banners;
CREATE POLICY "banners public read" ON public.banners FOR SELECT TO anon, authenticated
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "variants public read" ON public.product_variants;
CREATE POLICY "variants public read" ON public.product_variants FOR SELECT TO anon, authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR EXISTS (
    SELECT 1 FROM public.products p WHERE p.id = product_variants.product_id AND p.is_published = true));