import type { Metadata, Viewport } from "next";
import { Inter, Archivo } from "next/font/google";
import Script from "next/script";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { publicEnv } from "@/lib/env";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo", weight: ["600", "700", "800"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: {
    default: "Ellicottville Ski Exchange — Buy. Sell. Trade. Ski Local.",
    template: "%s · Ellicottville Ski Exchange",
  },
  description:
    "The local marketplace for buying and selling used ski and snowboard gear in Ellicottville, NY. Secure checkout, local pickup or drop-off, and verified seller reviews.",
  openGraph: {
    siteName: "Ellicottville Ski Exchange",
    type: "website",
    locale: "en_US",
  },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#13293d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${archivo.variable}`}>
      <body className="flex min-h-screen flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
          Skip to content
        </a>
        <Header />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
        {publicEnv.gaId && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${publicEnv.gaId}`} strategy="afterInteractive" />
            <Script id="ga" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${publicEnv.gaId}');`}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
