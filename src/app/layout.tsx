import type { Metadata, Viewport } from "next";
import { Overpass, Overpass_Mono } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { MobileTabBar } from "@/components/main-nav";
import { ThemeSync, themeScript } from "@/components/theme";
import { Toaster } from "@/components/ui/sonner";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
import "./globals.css";

// Overpass is an open-source version of Highway Gothic, the lettering on road
// and trail signs. One family for everything: heavy for titles, regular for text.
const overpass = Overpass({
  variable: "--font-overpass",
  subsets: ["latin"],
});

// Only for things you read out letter by letter: confirmation codes.
const overpassMono = Overpass_Mono({
  variable: "--font-code",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME}: ${APP_TAGLINE.toLowerCase()}`,
    template: `%s · ${APP_NAME}`,
  },
  description:
    "Keep your route, bookings, links and budget in one place, and copy other travellers' trips.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef2f0" },
    { media: "(prefers-color-scheme: dark)", color: "#12241f" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${overpass.variable} ${overpassMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <ThemeSync />
        <SiteHeader />
        {/* Bottom padding keeps content clear of the phone tab bar. */}
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-24 md:pb-10">
          {children}
        </main>
        <MobileTabBar />
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
