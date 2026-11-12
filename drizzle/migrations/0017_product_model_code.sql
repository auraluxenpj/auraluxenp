-- 0017: optional model code on products, used with the SKU to match stock between the website and BizSathi.
-- Additive and safe to re-run: one nullable column and one non-unique index. Nothing existing is changed.
-- Not unique on purpose: size/colour variants can share a model code.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS model_code text;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_model_code_clean;
ALTER TABLE public.products ADD CONSTRAINT products_model_code_clean CHECK (model_code IS NULL OR (model_code = btrim(model_code) AND length(model_code) BETWEEN 1 AND 64));
CREATE INDEX IF NOT EXISTS products_model_code_idx ON public.products (lower(model_code)) WHERE model_code IS NOT NULL;
