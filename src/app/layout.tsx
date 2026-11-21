import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: "E-Kanban",
  description: "Controle de materiais e reposição visual para oficinas e almoxarifados.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${geist.variable} dark h-full`} suppressHydrationWarning>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
