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
