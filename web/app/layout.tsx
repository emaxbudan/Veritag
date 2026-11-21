import type { Metadata, Viewport } from "next";
import { Navbar } from "@/components/Navbar";
import { I18nProvider } from "@/lib/i18n";
import { WalletProvider } from "@/lib/wallet-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "Veritag — On-Chain Product Authenticity & Warranty Registry",
  description:
    "Verify genuine products, claim scratch-secret Merkle warranties, and transfer ownership on Stellar Soroban.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Veritag",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icons/icon-192.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Veritag" />
      </head>
      <body className="min-h-screen flex flex-col">
        <I18nProvider>
          <WalletProvider>
            <Navbar />
            <main className="flex-1">{children}</main>
            <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
              Veritag · Powered by Stellar Soroban · Chain-anchored authenticity &amp; transferable
              warranties
            </footer>
          </WalletProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
