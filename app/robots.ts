import type { MetadataRoute } from "next";

/**
 * O que o buscador pode indexar.
 *
 * Tudo que fica atrás de login e os links de token são bloqueados: recibo
 * público e portal do contador são endereços com credencial embutida, e um
 * deles indexado vaza dado financeiro de um cliente real para quem
 * pesquisar.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/auth/",
        "/dashboard",
        "/movimento",
        "/orcamentos",
        "/clientes",
        "/cobranca",
        "/relatorio",
        "/configuracoes",
        "/nota-fiscal",
        "/planos",
        "/recibo/",
        "/admin",
        "/r/",
        "/contador/",
        "/redefinir-senha",
      ],
    },
    sitemap: "https://agilizemei.com.br/sitemap.xml",
  };
}
