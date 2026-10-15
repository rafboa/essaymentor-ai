import type { Metadata } from "next";
import { Big_Shoulders, Hanken_Grotesk, Literata } from "next/font/google";
import "./globals.css";
import { ClientProviders } from "./ClientProviders";
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";

const ui = Hanken_Grotesk({
  variable: "--font-ui",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const manuscript = Literata({
  variable: "--font-manuscript",
  subsets: ["latin", "latin-ext"],
  axes: ["opsz"],
  display: "swap",
});

const display = Big_Shoulders({
  variable: "--font-display-face",
  subsets: ["latin", "latin-ext"],
  axes: ["opsz"],
  display: "swap",
  // next/font has no fallback metrics for this family.
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: "EssayMentor AI — Evaluasi esai beasiswa",
  description:
    "Evaluasi esai beasiswa kalimat demi kalimat untuk LPDP, Chevening, Fulbright, dan lainnya. Skor lima dimensi dan catatan yang menunjuk langsung ke kalimatnya, tanpa menulis ulang suara Anda.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${ui.variable} ${manuscript.variable} ${display.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ClientProviders>
          <Navbar />
          <main id="content" className="flex-1">
            {children}
          </main>
          <Footer />
        </ClientProviders>
      </body>
    </html>
  );
}
