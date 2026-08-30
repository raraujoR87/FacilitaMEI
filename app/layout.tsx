import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgilizeMei — Financeiro simples pro seu negócio",
  metadataBase: new URL("https://agilizemei.com.br"),
  description:
    "Tira a foto da nota e a gente organiza. Financeiro, vendas e cobrança num só lugar, sem planilha e sem complicação.",
  openGraph: {
    title: "AgilizeMei — Financeiro simples pro seu negócio",
    description:
      "Tira a foto da nota e a gente organiza. Feito para o MEI que trabalha sozinho.",
    locale: "pt_BR",
    type: "website",
  },
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
