-- SKU-level image overrides point to the same central media asset used by BizSathi.
ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS image_url text;

ALTER TABLE public.product_variants
  DROP CONSTRAINT IF EXISTS product_variants_image_url_shared_media;
ALTER TABLE public.product_variants
  ADD CONSTRAINT product_variants_image_url_shared_media
  CHECK (
    image_url IS NULL OR
    image_url LIKE 'https://jsshaoucrjorbyuzagdr.supabase.co/storage/v1/object/public/product-images/%'
  );

CREATE INDEX IF NOT EXISTS product_variants_image_url_idx
  ON public.product_variants (image_url)
  WHERE image_url IS NOT NULL;
