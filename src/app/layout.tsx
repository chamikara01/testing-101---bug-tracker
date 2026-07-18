import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jbmono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const SITE_URL = "https://testing-101-bug-tracker.vercel.app";
const DESCRIPTION =
  "Track bugs, organize projects, and export polished bug reports - part of the Testing 101 QA toolkit.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Testing 101 Bug Tracker",
    template: "%s · Testing 101",
  },
  description: DESCRIPTION,
  icons: {
    icon: [{ url: "/testing101-mark.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    type: "website",
    siteName: "Testing 101 Bug Tracker",
    title: "Testing 101 Bug Tracker",
    description: DESCRIPTION,
    url: SITE_URL,
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Testing 101 Bug Tracker - bug tracking for QA teams",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Testing 101 Bug Tracker",
    description: DESCRIPTION,
    images: [`${SITE_URL}/og-image.png`],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
