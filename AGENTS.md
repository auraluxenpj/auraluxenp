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
- Inventory health uses administrator-verified, paginated narrow catalogue reads and pure exception analysis; keep the dashboard free of mutation controls and scope its query cache to the signed-in user.
- Home-screen installation uses manifest-only metadata and CDN icon pointers with a local favicon; do not add app-shell service workers or offline caches unless explicitly requested, to keep live store and preview updates safe.
- Category deletion checks product and coupon usage before removing unused categories; preserve linked records and keep existing foreign-key behavior as the database safety net.
- Category ordering is explicitly reviewed and saved as sort_order updates; on partial failure retain the proposed order for a retry rather than reporting success.
- Per-size stock is stored as colour-agnostic `product_variants` rows (one per size, colour null); the shop falls back to `products.stock` only when a product has no size rows. With "Track stock for each size" on, the editor keeps `products.stock` equal to the sum of the sizes.
- Product-information helpers centralize SKU composition and photo disclosure; SKUs use the shop's own garment letters (`AL-PW-660`, `AL-CO-662`, `AL-S-696`, plus K/SU/D/G/PZ/SH/T/OTH), legacy identifiers are preserved until admin review/save, and copies require an admin identifier before publication.
- The shared women's size guide is sourced body-measurement reference data, rendered alongside rather than replacing custom product charts; never extrapolate unsupported size measurements.
- POS sales use dedicated immutable sale/receipt and credit tables plus an authenticated atomic database RPC that locks shared product and size stock; keep online checkout and counter payments separate to preserve storefront payment restrictions.
- The admin shell permits staff only under /admin/pos; every POS server function/database RPC enforces admin-or-staff access, while existing admin surfaces retain admin-only access.
- Khata repayments and expenses are admin-only append-only records written through idempotent database RPCs; customer locks serialize credit accrual and repayment, while a narrow POS balance RPC exposes net balance without repayment details to staff.
- Business cashflow aggregates Nepal-local day boundaries and includes only cash sale totals, cash repayments and cash expenses; immutable vouchers share the POS print helper and receipt styles.
- Vendor contacts are editable while purchase bills/items/payments are immutable admin-only records; authenticated RPCs snapshot vendor identity, enforce normalized per-vendor invoice uniqueness and lock bills for idempotent bounded payments. Purchase tracking has no inventory or operating-cashflow side effects.
- Smart product upload (/admin/products/quick) drafts description/SEO/fabric/category/sizes/colours/SKU kind through an admin-only server function (has_role check) calling the Lovable AI gateway; the admin always reviews and saves manually — the AI never writes to the database directly.
