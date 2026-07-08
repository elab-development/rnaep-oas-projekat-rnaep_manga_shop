import Link from "next/link";

/**
 * Landing-page footer (ADR-0014). Server-rendered so its navigation lives in the
 * crawlable HTML and it sits inside the homepage's ISR shell — it holds no
 * per-user state, so it stays identical for every visitor (the session-aware
 * chrome is `SiteNav`, a client island). Navigation covers the shop's main
 * areas: catalog, genres (the catalog's genre filter), and the auth entry points.
 */

const NAV: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: "Browse",
    links: [
      { href: "/catalog", label: "Full catalog" },
      { href: "/catalog", label: "Browse by genre" },
    ],
  },
  {
    heading: "Account",
    links: [
      { href: "/login", label: "Sign in" },
      { href: "/register", label: "Register" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-foreground bg-background mt-24 border-t-2">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12 sm:flex-row sm:justify-between">
        <div className="flex flex-col gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="bg-primary text-primary-foreground border-foreground grid size-9 place-items-center border-2 text-xl leading-none font-black">
              漫
            </span>
            <span className="font-sans text-sm font-black tracking-[0.28em] uppercase">
              Manga&nbsp;Shop
            </span>
          </Link>
          <p className="text-muted-foreground max-w-xs text-sm">
            Authentic physical manga volumes. Priced in EUR, shipped for real.
          </p>
        </div>

        <nav
          aria-label="Footer"
          className="grid grid-cols-2 gap-8 sm:gap-16"
        >
          {NAV.map((group) => (
            <div key={group.heading} className="flex flex-col gap-3">
              <h2 className="font-mono text-xs font-bold tracking-[0.2em] uppercase">
                {group.heading}
              </h2>
              <ul className="flex flex-col gap-2">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-muted-foreground hover:text-foreground text-sm font-medium"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="border-foreground/15 border-t">
        <p className="text-muted-foreground mx-auto max-w-6xl px-6 py-5 font-mono text-xs tracking-wider uppercase">
          © {COPYRIGHT_YEAR} Manga Shop · A student project
        </p>
      </div>
    </footer>
  );
}

// Static year: the footer sits in the homepage's ISR shell (ADR-0014/0016), so a
// fixed constant keeps the cached HTML deterministic rather than drifting with a
// render-time `new Date()`. Bump when the project rolls over a year.
const COPYRIGHT_YEAR = 2026;
