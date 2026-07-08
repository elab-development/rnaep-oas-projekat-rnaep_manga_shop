import type { Metadata } from "next"
import { Space_Grotesk, Space_Mono } from "next/font/google"

import "@workspace/ui/globals.css"
import { SiteNav } from "@/components/site-nav"
import { ThemeProvider } from "@/components/theme-provider"
import { siteUrl } from "@/lib/site"
import { cn } from "@workspace/ui/lib/utils";

/**
 * Site-wide SEO defaults (issue 04). `metadataBase` resolves every relative
 * `alternates.canonical` / Open Graph URL against the configured base origin
 * (`NEXT_PUBLIC_SITE_URL`, dev-default `http://localhost:3010`), so no page
 * hardcodes a domain. The `template` gives every child page a coherent,
 * unique `"<page> · Manga Shop"` title; the homepage overrides it with an
 * absolute, keyword-led title. Per-page `description` + `canonical` live on the
 * individual routes.
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "Manga Shop — Buy Authentic Physical Manga Volumes",
    template: "%s · Manga Shop",
  },
  description:
    "Shop authentic, licensed physical manga volumes. Search by title, browse by genre, and see real stock and EUR prices with live USD, GBP and JPY labels.",
  openGraph: {
    type: "website",
    siteName: "Manga Shop",
    url: "/",
    title: "Manga Shop — Buy Authentic Physical Manga Volumes",
    description:
      "Authentic, licensed physical manga volumes — priced in EUR, ready to ship. Browse the catalog, search by title, and filter by genre.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Manga Shop — Buy Authentic Physical Manga Volumes",
    description:
      "Authentic, licensed physical manga volumes — priced in EUR, ready to ship. Browse the catalog, search by title, and filter by genre.",
  },
}

// ADR-0014: Space Grotesk carries display + body, Space Mono carries data/prices/labels.
const fontSans = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
})

const fontMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", fontSans.variable)}
    >
      <body className="bg-dots">
        <ThemeProvider>
          <SiteNav />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
