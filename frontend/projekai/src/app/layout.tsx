import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "EssayMentor AI — Scholarship Essay Evaluator",
  description:
    "Smart, voice-preserving scholarship essay feedback in English and Indonesian. Get a readiness score and actionable feedback for LPDP, Fulbright, Chevening, and more.",
};

import { ClientProviders } from "./ClientProviders";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="bg-glow min-h-full flex flex-col" suppressHydrationWarning>
        <ClientProviders>
          <Navbar />
          <main className="relative z-10 flex-1">{children}</main>
          <Footer />
        </ClientProviders>
      </body>
    </html>
  );
}
