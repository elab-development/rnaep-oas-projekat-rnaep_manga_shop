import { cn } from "@workspace/ui/lib/utils";

// ADR-0014: display voice is Space Grotesk (the app font-sans), used heavy +
// uppercase. Space Mono (font-mono) carries kickers and labels. No bespoke
// display face — the design system owns typography.

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div
      className={cn(
        "grid min-h-svh w-full lg:grid-cols-[1.1fr_1fr]",
        "bg-background text-foreground",
      )}
    >
      <BrandPanel />
      <main className="bg-dots relative flex items-center justify-center px-6 py-12 sm:px-12">
        <div className="relative w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}

function BrandPanel() {
  return (
    <aside className="bg-foreground text-background bg-dots relative hidden flex-col justify-between overflow-hidden p-12 [--dots:color-mix(in_oklab,var(--background)_12%,transparent)] lg:flex">
      <div className="relative flex items-center gap-3">
        <span className="bg-primary text-primary-foreground border-foreground grid size-11 place-items-center border text-2xl leading-none font-black">
          漫
        </span>
        <span className="font-sans text-lg font-bold tracking-[0.3em] uppercase">
          Manga&nbsp;Shop
        </span>
      </div>

      <div className="relative">
        <p className="mb-4 font-sans text-6xl leading-[0.92] font-black tracking-tight uppercase xl:text-7xl">
          Stories
          <br />
          worth
          <br />
          {/* Yellow reads as high-contrast on the inked panel — allowed here. */}
          <span className="text-primary">shelving.</span>
        </p>
        <p className="text-background/70 max-w-sm text-sm leading-relaxed">
          Real volumes, real ink, real availability. Browse the shelf, reserve
          your copy, and check out securely — your cart waits for you, never
          oversold.
        </p>
      </div>

      <div className="text-background/50 relative flex items-center gap-3 font-mono text-xs tracking-[0.25em] uppercase">
        <span className="bg-primary inline-block h-1 w-10" />
        第一巻 · Volume One
      </div>
    </aside>
  );
}
