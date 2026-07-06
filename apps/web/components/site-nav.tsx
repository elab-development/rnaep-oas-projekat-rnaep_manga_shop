"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { IconMenu2 } from "@tabler/icons-react";
import { clearToken } from "@/lib/auth";
import { cn } from "@workspace/ui/lib/utils";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { currentSession, isAdmin, isModerator, type Session } from "@/lib/session";

/**
 * Global top navigation. Links are chosen from the token the browser holds, so
 * this is client-side and for UX only — the same role gate every page already
 * uses (ADR-0005, ADR-0007). Hiding a link never guards a route: services
 * re-verify the JWT on every call, so a link the nav omits is still enforced.
 */

type NavLink = { href: string; label: string; kicker?: string };

/** Public destinations everyone sees, signed in or not. */
const PUBLIC_LINKS: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/catalog", label: "Catalog" },
];

export function SiteNav() {
  // Session comes from localStorage (unavailable during SSR). Resolve it after
  // mount to keep the server and first client render in agreement — the same
  // pattern the admin/moderator pages use.
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Re-read on every navigation so the nav reflects login/logout without a
    // full reload (login redirects, so the pathname change re-runs this).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(currentSession());
    setReady(true);
  }, [pathname]);

  // The (auth) route group owns the full viewport with its own brand panel —
  // a top bar there would fight that layout, so stay out of its way.
  if (pathname === "/login" || pathname === "/register") return null;

  const links = [...PUBLIC_LINKS];
  if (session) links.push({ href: "/cart", label: "Cart" });
  if (isModerator(session)) {
    links.push({ href: "/moderator", label: "Catalog Desk", kicker: "Staff" });
  }
  if (isAdmin(session)) {
    links.push({ href: "/admin", label: "User Desk", kicker: "Staff" });
  }

  function signOut() {
    clearToken();
    setSession(null);
    // Leave any staff/cart page whose content was rendered under the old token.
    router.push("/");
  }

  return (
    <header className="border-foreground bg-background sticky top-0 z-50 border-b-2">
      <nav className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-3">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="bg-primary text-primary-foreground border-foreground grid size-9 place-items-center border-2 text-xl leading-none font-black">
            漫
          </span>
          <span className="hidden font-sans text-sm font-black tracking-[0.28em] uppercase sm:inline">
            Manga&nbsp;Shop
          </span>
        </Link>

        {/* Desktop: inline links + auth actions (sm and up). */}
        <ul className="hidden flex-1 flex-wrap items-center gap-1 sm:flex">
          {links.map((link) => (
            <li key={link.href}>
              <NavItem link={link} active={isActive(pathname, link.href)} />
            </li>
          ))}
        </ul>

        <div className="hidden shrink-0 items-center gap-3 sm:flex">
          {!ready ? null : session ? (
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={signOut}
              className="brutal-btn px-3 font-mono text-xs font-bold tracking-wider uppercase"
            >
              Sign out
            </Button>
          ) : (
            <>
              <Link
                href="/login"
                className="hover:text-foreground/70 font-mono text-xs font-bold tracking-wider uppercase"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className={buttonVariants({
                  size: "lg",
                  className:
                    "brutal-btn px-3 font-mono text-xs font-bold tracking-wider uppercase",
                })}
              >
                Register
              </Link>
            </>
          )}
        </div>

        {/* Mobile: everything collapses into a single dropdown (below sm). */}
        {ready && (
          <div className="ml-auto sm:hidden">
            <MobileMenu
              links={links}
              pathname={pathname}
              session={session}
              onSignOut={signOut}
            />
          </div>
        )}
      </nav>
    </header>
  );
}

function MobileMenu({
  links,
  pathname,
  session,
  onSignOut,
}: {
  links: NavLink[];
  pathname: string;
  session: Session | null;
  onSignOut: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Open menu"
        className={buttonVariants({
          variant: "outline",
          size: "icon-lg",
          className: "brutal-btn",
        })}
      >
        <IconMenu2 className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="border-foreground w-48 border-2 font-mono text-xs font-bold tracking-wider uppercase"
      >
        {links.map((link) => {
          const active = isActive(pathname, link.href);
          return (
            <DropdownMenuItem
              key={link.href}
              render={<Link href={link.href} />}
              className={cn(active && "text-primary")}
            >
              {link.label}
              {link.kicker && (
                <span className="text-foreground/40 ml-auto text-[0.6rem]">
                  {link.kicker}
                </span>
              )}
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator className="bg-foreground/20" />

        {session ? (
          <DropdownMenuItem variant="destructive" onClick={onSignOut}>
            Sign out
          </DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuItem render={<Link href="/login" />}>
              Sign in
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/register" />}>
              Register
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NavItem({ link, active }: { link: NavLink; active: boolean }) {
  return (
    <Link
      href={link.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative block whitespace-nowrap px-3 py-2 font-mono text-xs font-bold tracking-wider uppercase transition-colors",
        active
          ? "text-foreground"
          : "text-foreground/55 hover:text-foreground",
      )}
    >
      {link.kicker && (
        <span className="text-primary mr-1.5 hidden text-[0.6rem] tracking-[0.2em] md:inline">
          {link.kicker}
        </span>
      )}
      {link.label}
      {active && (
        <span className="bg-primary absolute inset-x-3 bottom-0 h-0.5" />
      )}
    </Link>
  );
}

/** Active when the path equals the link or sits under it (e.g. /catalog/42). */
function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
