-- Shared product media catalog. Storage remains in Auraluxe's existing public product-images bucket.
-- Asset rows are internal metadata; storefront images are served by the bucket's public CDN URL.
create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  sha256 text not null unique check (sha256 ~ '^[0-9a-f]{64}$'),
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/webp','image/jpeg','image/png','image/avif')),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 15728640),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.media_assets enable row level security;
drop policy if exists "Admins can view media assets" on public.media_assets;
create policy "Admins can view media assets" on public.media_assets
  for select to authenticated using (public.has_role(auth.uid(), 'admin'::public.app_role));
drop policy if exists "Admins can register media assets" on public.media_assets;
create policy "Admins can register media assets" on public.media_assets
  for insert to authenticated with check (public.has_role(auth.uid(), 'admin'::public.app_role));
grant select, insert on public.media_assets to authenticated;
revoke all on public.media_assets from anon;

create index if not exists media_assets_created_at_idx on public.media_assets(created_at desc);
