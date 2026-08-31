"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { rotuloMes, ultimosMeses } from "@/lib/formato";

/**
 * Troca o mês sem recarregar a página.
 *
 * A navegação já era leve, mas sem `useTransition` o React esperava o
 * servidor responder antes de repintar qualquer coisa: o `select` ficava
 * travado no mês antigo e a tela parecia congelada. Agora o campo responde
 * na hora e só o conteúdo espera.
 */
export function SeletorMes({ mes }: { mes: string }) {
  const router = useRouter();
  const parametros = useSearchParams();
  const [carregando, iniciar] = useTransition();

  function trocar(novoMes: string) {
    const busca = new URLSearchParams(parametros.toString());
    busca.set("mes", novoMes);
    iniciar(() => router.push(`?${busca.toString()}`));
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span style={{ color: "var(--tinta-suave)" }}>Mês</span>
      <select
        value={mes}
        onChange={(e) => trocar(e.target.value)}
        aria-busy={carregando}
        className="campo w-auto py-1.5"
        style={{ opacity: carregando ? 0.6 : 1, transition: "opacity 120ms ease" }}
      >
        {ultimosMeses(12).map((m) => (
          <option key={m} value={m}>
            {rotuloMes(m)}
          </option>
        ))}
      </select>
    </label>
  );
}
