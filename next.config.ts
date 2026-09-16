import type { NextConfig } from "next";

/**
 * Cabeçalhos de segurança.
 *
 * O site servia só HSTS. Para um app que guarda faturamento e dado de
 * cliente, o mínimo é impedir que a página seja embutida em outro site
 * (clickjacking em cima de um botão de "Recebi" é dinheiro marcado como
 * pago sem o dono saber) e restringir de onde o navegador aceita carregar
 * código e para onde pode enviar dados.
 *
 * Sobre a CSP: `script-src` fica em 'self' com 'unsafe-inline'. O ideal
 * seria nonce por requisição, mas o Next injeta scripts inline de
 * hidratação e o nonce teria que atravessar o middleware — risco alto de
 * quebrar a área logada, que não dá para testar sem sessão. Mesmo sem
 * nonce, a regra já barra o vetor mais comum: carregar script de um
 * domínio de fora. E `connect-src` limita para onde os dados podem sair.
 */
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

// Em desenvolvimento o React usa `eval` para reconstruir pilha de erro. Ele
// mesmo avisa que nunca faz isso em produção — liberar só aqui evita que o
// ruído no console de dev esconda erro de verdade, sem afrouxar o que vai
// para o ar.
const EM_DEV = process.env.NODE_ENV !== "production";
const EVAL_EM_DEV = EM_DEV ? " 'unsafe-eval'" : "";
// O hot-reload do Next fala por WebSocket com o próprio servidor; sem esta
// liberação a CSP derruba a conexão e a página para de recarregar sozinha.
const HMR_EM_DEV = EM_DEV ? " ws://localhost:* http://localhost:*" : "";

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  // 'unsafe-inline' é necessário para os scripts de hidratação do Next.
  `script-src 'self' 'unsafe-inline'${EVAL_EM_DEV} https://va.vercel-scripts.com`,
  // Tailwind e os estilos inline das telas exigem 'unsafe-inline' aqui.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  // `data:` e `blob:` cobrem a prévia da assinatura desenhada no canvas;
  // o domínio do Supabase serve o logo guardado no Storage.
  `img-src 'self' data: blob: ${supabase}`,
  `connect-src 'self' ${supabase} https://va.vercel-scripts.com${HMR_EM_DEV}`,
  "form-action 'self'",
  // Equivalente moderno do X-Frame-Options, que fica abaixo para
  // navegadores antigos.
  "frame-ancestors 'none'",
  "object-src 'none'",
  "upgrade-insecure-requests",
]
  .filter((linha) => !linha.endsWith(" "))
  .join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:caminho*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            // A câmera fica liberada para o próprio site: o envio de nota
            // por foto depende dela no celular.
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
