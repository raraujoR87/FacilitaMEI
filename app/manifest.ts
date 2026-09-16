import type { MetadataRoute } from "next";

/**
 * Instalável na tela inicial do celular.
 *
 * A promessa do produto é "funciona no celular"; sem manifesto o navegador
 * não oferece instalar, e o app fica sempre a uma aba de distância em vez
 * de a um toque.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AgilizeMei — financeiro do MEI",
    short_name: "AgilizeMei",
    description:
      "Recibo com a sua marca, cobrança por PIX e o teto do MEI sob controle.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f7f5f0",
    theme_color: "#f7f5f0",
    lang: "pt-BR",
    icons: [
      { src: "/icone-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icone-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
