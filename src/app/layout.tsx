import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import GlobalNav from "@/components/GlobalNav";

const inter = Inter({ subsets: ["latin"] });

// Force dynamic rendering to avoid issues with client-side providers during static generation
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "QuiverDM - TTRPG Campaign Management for Dungeon Masters",
  description: "Organize sessions, track NPCs, manage homebrew content, and keep your campaigns running smoothly. Built for Dungeon Masters.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "QuiverDM",
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: "#8B5CF6",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <Providers>
          <GlobalNav />
          {children}
        </Providers>
      </body>
    </html>
  );
}
