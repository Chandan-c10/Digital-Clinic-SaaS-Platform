import Link from "next/link";

/**
 * Plain links with a `page` query param — no client JS needed, matching the
 * branch-filter-on-reports convention (a page navigation is a real page
 * navigation). `searchParams` should be the page's own, so other filters
 * (search, includeInactive, …) survive moving between pages.
 */
export function Pager({
  page,
  totalPages,
  basePath,
  searchParams,
}: {
  page: number;
  totalPages: number;
  basePath: string;
  searchParams: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;

  function hrefFor(targetPage: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value && key !== "page") params.set(key, value);
    }
    params.set("page", String(targetPage));
    return `${basePath}?${params.toString()}`;
  }

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between pt-2 text-sm">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className="font-medium text-brand-600 hover:text-brand-700">
          ← Previous
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
      <span className="text-slate-500">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className="font-medium text-brand-600 hover:text-brand-700">
          Next →
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
    </nav>
  );
}
