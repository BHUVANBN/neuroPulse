import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NeuroPulse - Parkinson's Tremor Detector",
  description: "AI-powered Parkinson's disease tremor monitoring and analysis platform with real-time classification",
  metadataBase: new URL("https://neuropulse.local"),
  openGraph: {
    title: "NeuroPulse",
    description: "Advanced EMG-based Parkinson's tremor detection with frequency analysis and multi-user dashboards",
    type: "website",
  },
  keywords: [
    "NeuroPulse",
    "Parkinson's",
    "EMG",
    "Tremor Detection",
    "AI Healthcare",
    "Next.js",
    "Medical Technology",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider>
          <ThemeToggle />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
