import { Space_Grotesk, Space_Mono } from "next/font/google"
import { headers } from "next/headers"

import "@workspace/ui/globals.css"
import { SiteNav } from "@/components/site-nav"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@workspace/ui/lib/utils";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // The CSP middleware mints a per-request nonce; hand it to next-themes so its
  // inline anti-flash script is trusted under our strict script-src (ADR-0012).
  const nonce = (await headers()).get("x-nonce") ?? undefined
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", fontSans.variable)}
    >
      <body>
        <ThemeProvider nonce={nonce}>
          <SiteNav />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
