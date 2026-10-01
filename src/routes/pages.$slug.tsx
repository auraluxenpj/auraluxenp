import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/site/SiteLayout";
import { fetchPage } from "@/lib/data";

export const Route = createFileRoute("/pages/$slug")({
  head: ({ params }) => {
    const pretty = params.slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return {
      meta: [
        { title: `${pretty} — Auraluxe` },
        { name: "description", content: `${pretty} for Auraluxe, Nepalgunj.` },
        { property: "og:title", content: `${pretty} — Auraluxe` },
        { property: "og:description", content: `${pretty} for Auraluxe, Nepalgunj.` },
      ],
    };
  },
  component: PageView,
});

function PageView() {
  const { slug } = Route.useParams();
  const { data: page, isLoading } = useQuery({
    queryKey: ["page", slug],
    queryFn: () => fetchPage(slug),
  });

  return (
    <SiteLayout>
      <article className="glass mt-10 rounded-3xl p-8 sm:p-12">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : page ? (
          <>
            <h1 className="font-display text-4xl sm:text-5xl">{page.title}</h1>
            <div className="mt-6 max-w-2xl whitespace-pre-line text-[15px] leading-relaxed text-muted-foreground">
              {page.content}
            </div>
          </>
        ) : (
          <h1 className="font-display text-3xl">This page hasn't been written yet.</h1>
        )}
      </article>
    </SiteLayout>
  );
}
