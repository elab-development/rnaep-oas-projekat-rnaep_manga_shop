import { Anton } from "next/font/google";
import { cn } from "@workspace/ui/lib/utils";

// Anton: a condensed poster/display face — the manga cover-logo voice. Distinct
// from the body Geist so headings read like printed tankōbon spines.
const display = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div
      className={cn(
        display.variable,
        "grid min-h-svh w-full lg:grid-cols-[1.1fr_1fr]",
        "bg-[#f3efe5] text-[#15130f]",
      )}
    >
      <BrandPanel />
      <main className="relative flex items-center justify-center px-6 py-12 sm:px-12">
        {/* Halftone dot field — the screentone wash behind the form. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "radial-gradient(#15130f 1.1px, transparent 1.2px)",
            backgroundSize: "10px 10px",
          }}
        />
        <div className="relative w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}

function BrandPanel() {
  return (
    <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#15130f] p-12 text-[#f3efe5] lg:flex">
      {/* Diagonal speed-lines, the manga sense of motion. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(115deg, #f3efe5 0 2px, transparent 2px 22px)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -bottom-24 size-[28rem] rounded-full opacity-[0.10]"
        style={{
          backgroundImage:
            "radial-gradient(#f3efe5 1.4px, transparent 1.5px)",
          backgroundSize: "14px 14px",
        }}
      />

      <div className="relative flex items-center gap-3">
        <span className="grid size-11 place-items-center bg-primary font-[family-name:var(--font-display)] text-2xl leading-none text-primary-foreground">
          漫
        </span>
        <span className="font-[family-name:var(--font-display)] text-lg tracking-[0.3em] uppercase">
          Manga&nbsp;Shop
        </span>
      </div>

      <div className="relative">
        <p className="mb-4 font-[family-name:var(--font-display)] text-6xl leading-[0.92] tracking-tight uppercase xl:text-7xl">
          Stories
          <br />
          worth
          <br />
          <span className="text-primary">shelving.</span>
        </p>
        <p className="max-w-sm text-sm leading-relaxed text-[#f3efe5]/70">
          Real volumes, real ink, real availability. Browse the shelf, reserve
          your copy, and check out securely — your cart waits for you, never
          oversold.
        </p>
      </div>

      <div className="relative flex items-center gap-3 text-xs tracking-[0.25em] text-[#f3efe5]/50 uppercase">
        <span className="inline-block h-px w-10 bg-primary" />
        第一巻 · Volume One
      </div>
    </aside>
  );
}
