import Link from "next/link";
import { buttonVariants } from "@workspace/ui/components/button";

export default function Page() {
  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <div className="flex flex-col gap-4">
        <span className="font-mono text-xs font-bold tracking-[0.3em] uppercase">
          漫 · Manga Shop
        </span>
        <h1 className="font-[family-name:var(--font-sans)] text-6xl leading-[0.95] font-bold tracking-tight uppercase">
          Stories worth
          <br />
          shelving.
        </h1>
        <p className="text-muted-foreground max-w-prose text-lg">
          Browse a catalog of physical manga volumes — search by title, filter
          by genre, and see real availability before you buy.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/catalog"
          className={buttonVariants({
            size: "lg",
            className: "brutal-btn min-w-40",
          })}
        >
          Browse the shelf
        </Link>
        <Link
          href="/login"
          className={buttonVariants({
            variant: "outline",
            size: "lg",
            className: "brutal-btn min-w-40",
          })}
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
