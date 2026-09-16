import type { MetadataRoute } from "next";

/** Só as páginas públicas — o resto exige login e não deve ser indexado. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://agilizemei.com.br";
  const agora = new Date();

  return [
    { url: base, lastModified: agora, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/cadastro`, lastModified: agora, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/login`, lastModified: agora, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/termos`, lastModified: agora, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/privacidade`, lastModified: agora, changeFrequency: "yearly", priority: 0.2 },
  ];
}
