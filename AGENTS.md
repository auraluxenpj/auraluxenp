<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Category management reuses the protected admin layout and existing category RLS; invalidate the shared categories query after writes so shop and product forms reflect changes.
- Category deletion checks product and coupon usage before removing unused categories; preserve linked records and keep existing foreign-key behavior as the database safety net.
- Category ordering is explicitly reviewed and saved as sort_order updates; on partial failure retain the proposed order for a retry rather than reporting success.
- Per-size stock is stored as colour-agnostic `product_variants` rows (one per size, colour null); the shop falls back to `products.stock` only when a product has no size rows. With "Track stock for each size" on, the editor keeps `products.stock` equal to the sum of the sizes.
- Product-information helpers centralize SKU composition and photo disclosure; SKUs use the shop's own garment letters (`AL-PW-660`, `AL-CO-662`, `AL-S-696`, plus K/SU/D/G/PZ/SH/T/OTH), legacy identifiers are preserved until admin review/save, and copies require an admin identifier before publication.
- The shared women's size guide is sourced body-measurement reference data, rendered alongside rather than replacing custom product charts; never extrapolate unsupported size measurements.
- POS sales use dedicated immutable sale/receipt and credit tables plus an authenticated atomic database RPC that locks shared product and size stock; keep online checkout and counter payments separate to preserve storefront payment restrictions.
- The admin shell permits staff only under /admin/pos; every POS server function/database RPC enforces admin-or-staff access, while existing admin surfaces retain admin-only access.
