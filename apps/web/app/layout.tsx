import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono, Inter, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { Providers } from "@/app/providers";

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://qametrics.cl"),
  title: {
    default: "QA Metrics · Plataforma de métricas QA de Inovabiz",
    template: "%s · QA Metrics",
  },
  description:
    "Centraliza la operación QA de todos tus proyectos. Dashboards, reportes y visibilidad del equipo en una sola plataforma.",
  applicationName: "QA Metrics",
  authors: [{ name: "Inovabiz", url: "https://inovabiz.com" }],
  generator: "Next.js",
  keywords: [
    "QA",
    "métricas QA",
    "dashboards QA",
    "testing",
    "Azure DevOps",
    "plataforma QA",
    "Inovabiz",
    "aseguramiento de calidad",
    "reportes QA",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${ibmPlexSans.variable} ${ibmPlexMono.variable} ${inter.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
