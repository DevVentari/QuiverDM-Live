import type { Metadata, Viewport } from "next";
import { Cinzel, Crimson_Text } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import GlobalNav from "@/components/GlobalNav";

const fontDisplay = Cinzel({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
});

const fontBody = Crimson_Text({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "600"],
});

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
  themeColor: "#0f0d0b", // Updated to match the dark theme
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${fontDisplay.variable} ${fontBody.variable} font-body text-base/relaxed`}>
        <Providers>
          <GlobalNav />
          {children}
        </Providers>
      </body>
    </html>
  );
}
