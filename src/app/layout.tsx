import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { Suspense } from "react";
import { NavTracker } from "@/components/app/NavTracker";
import { OnboardGate } from "@/components/app/OnboardGate";
import { SideNav } from "@/components/app/SideNav";
import { Splash } from "@/components/app/Splash";
import { SyncAgent } from "@/components/app/SyncAgent";
import { WalletPanel } from "@/components/app/WalletPanel";
import { THEME_SCRIPT, ThemeSync } from "@/components/app/ThemeSync";
import { Toaster } from "@/components/ui/Toaster";
import "./globals.css";

const sans = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
});

const mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext", "symbols2"],
});

export const metadata: Metadata = {
  title: "TacketPay — demo payments",
  description: "A mobile payments app that runs entirely on demo money over TPI, a UPI-style network. Scan QR codes, pay friends and earn scratch cards — nothing real ever moves.",
  applicationName: "TacketPay",
  appleWebApp: { capable: true, title: "TacketPay", statusBarStyle: "default" },
  robots: { index: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className={`${sans.variable} ${mono.variable} antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <div className="stage">
          {/* The sidebar highlights the current page, which isn't known while prerendering dynamic routes. */}
          <Suspense fallback={<div className="side-nav h-dvh w-[4.5rem] shrink-0 lg:w-[15.5rem]" aria-hidden="true" />}>
            <SideNav />
          </Suspense>
          <div id="device" className="device">
            {children}
            <Toaster />
            <Splash />
          </div>
          <WalletPanel />
        </div>
        <ThemeSync />
        <SyncAgent />
        <Suspense fallback={null}>
          <NavTracker />
          <OnboardGate />
        </Suspense>
      </body>
    </html>
  );
}
