import { ImageResponse } from "next/og";

/**
 * Imagem de compartilhamento.
 *
 * O público vive no WhatsApp, e era justamente lá que o link chegava
 * "pelado": sem `og:image`, o app mostra só a URL crua e o convite perde a
 * cara de produto. Gerada aqui em vez de virar um PNG no repositório para
 * acompanhar a marca sem exigir editor de imagem a cada ajuste.
 */
export const alt = "AgilizeMei — financeiro simples pro seu negócio";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Imagem() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f7f5f0",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: 999,
              background: "#2F6E5B",
            }}
          />
          {/* Duas caixas em vez de texto + span: o renderizador do `next/og`
              exige `display` explícito em qualquer nó com mais de um filho,
              e quebra o build se faltar. */}
          <div style={{ display: "flex", fontSize: 30, fontWeight: 700 }}>
            <div style={{ display: "flex", color: "#1a1a1a" }}>Agilize</div>
            <div style={{ display: "flex", color: "#2F6E5B" }}>Mei</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              color: "#1a1a1a",
              lineHeight: 1.05,
              letterSpacing: -2,
              maxWidth: 900,
            }}
          >
            Seu financeiro resolvido no celular.
          </div>
          <div style={{ fontSize: 30, color: "#59564e", maxWidth: 820 }}>
            Recibo com a sua marca, cobrança por PIX e o teto do MEI sob
            controle. Sem planilha.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              display: "flex",
              background: "#1a1a1a",
              color: "#fff",
              fontSize: 26,
              fontWeight: 600,
              padding: "14px 28px",
              borderRadius: 10,
            }}
          >
            agilizemei.com.br
          </div>
          <div style={{ fontSize: 24, color: "#59564e" }}>
            14 dias de Pro para testar
          </div>
        </div>
      </div>
    ),
    size
  );
}
