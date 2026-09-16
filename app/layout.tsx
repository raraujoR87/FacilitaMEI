import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const TITULO = "AgilizeMei — Financeiro simples pro seu negócio";
const DESCRICAO =
  "Tira a foto da nota e a gente organiza. Recibo com a sua marca, cobrança por PIX e o teto do MEI sob controle, sem planilha.";

export const metadata: Metadata = {
  title: TITULO,
  metadataBase: new URL("https://agilizemei.com.br"),
  description: DESCRICAO,
  applicationName: "AgilizeMei",
  // Sem canonical, o mesmo conteúdo servido em www e apex conta como duas
  // páginas para o buscador.
  alternates: { canonical: "/" },
  openGraph: {
    title: TITULO,
    description: DESCRICAO,
    url: "/",
    siteName: "AgilizeMei",
    locale: "pt_BR",
    type: "website",
  },
  // O link é compartilhado no WhatsApp, que lê `og:` — e o Twitter/X lê
  // esta família. A imagem em si vem de `app/opengraph-image.tsx`.
  twitter: {
    card: "summary_large_image",
    title: TITULO,
    description: DESCRICAO,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#f7f5f0",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        {/* Sem medição não dá para saber se a landing converte. O da Vercel
            é sem cookie e sem identificar o visitante, o que mantém a
            promessa da política de privacidade. */}
        <Analytics />
      </body>
    </html>
  );
}
