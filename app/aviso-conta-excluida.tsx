"use client";

import { useSearchParams } from "next/navigation";

/**
 * Aviso de conta excluída.
 *
 * Existe como componente de cliente por um motivo de desempenho, não de
 * estilo: ler `searchParams` na página forçava a home inteira a ser
 * renderizada a cada visita. Isolado aqui, a landing volta a ser estática
 * e sai do CDN — e é ela que recebe o tráfego de divulgação.
 */
export function AvisoContaExcluida() {
  const excluida = useSearchParams().get("conta") === "excluida";
  if (!excluida) return null;

  return (
    <div
      className="border-b"
      style={{ borderColor: "var(--borda)", background: "var(--papel-escuro)" }}
    >
      <p className="max-w-5xl mx-auto px-5 py-3 text-sm" role="status">
        Sua conta foi excluída e os dados apagados. Obrigado por ter usado o
        AgilizeMei.
      </p>
    </div>
  );
}
