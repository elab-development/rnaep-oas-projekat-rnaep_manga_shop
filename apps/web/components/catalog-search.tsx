import { Button } from "@workspace/ui/components/button";

/**
 * Catalog search/filter form. A native GET form so it works without client JS:
 * submitting navigates to `/catalog?q=…&genre=…`, which the server component
 * reads back. Resetting to page 1 is implicit — the form omits `page`.
 */
export function CatalogSearch({
  q,
  genre,
}: {
  q?: string;
  genre?: string;
}) {
  return (
    <form
      action="/catalog"
      method="get"
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <label className="flex flex-1 flex-col gap-1">
        <span className="font-mono text-xs font-bold tracking-wide uppercase">
          Title
        </span>
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by title…"
          className="border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
        />
      </label>
      <label className="flex flex-1 flex-col gap-1 sm:max-w-56">
        <span className="font-mono text-xs font-bold tracking-wide uppercase">
          Genre
        </span>
        <input
          type="text"
          name="genre"
          defaultValue={genre}
          placeholder="e.g. Action"
          className="border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
        />
      </label>
      <Button type="submit" className="sm:w-auto">
        Browse
      </Button>
    </form>
  );
}
