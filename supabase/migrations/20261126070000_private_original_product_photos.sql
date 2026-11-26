-- Keep the original product upload privately for admin-only reuse.
alter table public.media_assets
  add column if not exists original_storage_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-originals', 'product-originals', false, 15728640, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No client-facing policies: originals are accessed only through authenticated
-- server routes using the service-role client and short-lived signed URLs.
