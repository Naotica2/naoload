import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#020617",
};

export const metadata: Metadata = {
  title: "Naoload | Premium Social Media Downloader",
  description: "Effortless media downloads, simplified. Download videos and audio from TikTok, Instagram, and Facebook for free.",
  keywords: ["social media downloader", "tiktok downloader", "instagram downloader", "facebook downloader", "video downloader", "mp3 converter"],
  openGraph: {
    title: "Naoload | Premium Social Media Downloader",
    description: "Effortless media downloads, simplified.",
    type: "website",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Naoload",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
