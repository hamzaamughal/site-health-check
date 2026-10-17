import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Free Website Health Check",
  description:
    "Find out in 60 seconds what's costing your website customers: speed, mobile, broken links, missing contact forms and more. Free, no signup.",
  openGraph: {
    title: "Free Website Health Check",
    description: "See what's costing your website customers — speed, mobile, broken links, forms. Free report in 60 seconds.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1d1a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=Figtree:wght@400..700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
