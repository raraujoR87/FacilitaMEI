import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FacilitaMEI — Financeiro simples pro seu negócio",
  description:
    "Manda a nota pelo WhatsApp, a gente organiza. Financeiro, vendas e cobrança num só lugar, sem complicação.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
