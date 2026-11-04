import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { fetchPage } from "@/lib/data";

function summary(text: string | null | undefined) {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  return clean.length > 155 ? `${clean.slice(0, 152)}…` : clean;
}

export const Route = createFileRoute("/pages/$slug")({
  loader: async ({ params }) => ({ page: await fetchPage(params.slug).catch(() => null) }),
  head: ({ params, loaderData }) => {
    const page = loaderData?.page;
    const url = `https://www.auraluxe.com.np/pages/${params.slug}`;
    if (!page || !page.content?.trim()) {
      return {
        meta: [
          { title: "Page not available — Auraluxe" },
          { name: "robots", content: "noindex, follow" },
        ],
      };
    }
    const title = `${page.title} — Auraluxe Nepalgunj`;
    const description = summary(page.content) || `${page.title} from Auraluxe, Nepalgunj.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: PageView,
});

function PageView() {
  const { page } = Route.useLoaderData();
  const written = page && page.content?.trim();

  return (
    <SiteLayout>
      <article className="glass mt-10 rounded-3xl p-8 sm:p-12">
        {written ? (
          <>
            <h1 className="font-display text-4xl sm:text-5xl">{page.title}</h1>
            <div className="mt-6 max-w-2xl whitespace-pre-line text-[15px] leading-relaxed text-muted-foreground">
              {page.content}
            </div>
          </>
        ) : (
          <>
            <h1 className="font-display text-3xl">This page isn't available</h1>
            <p className="mt-4 text-sm text-muted-foreground">
              Browse the <a href="/shop" className="underline">shop</a> or <a href="/contact" className="underline">contact us</a>.
            </p>
          </>
        )}
      </article>
    </SiteLayout>
  );
}
