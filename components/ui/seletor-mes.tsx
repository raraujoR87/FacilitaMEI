"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { rotuloMes, ultimosMeses } from "@/lib/formato";

export function SeletorMes({ mes }: { mes: string }) {
  const router = useRouter();
  const parametros = useSearchParams();

  function trocar(novoMes: string) {
    const busca = new URLSearchParams(parametros.toString());
    busca.set("mes", novoMes);
    router.push(`?${busca.toString()}`);
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span style={{ color: "var(--tinta-suave)" }}>Mês</span>
      <select
        value={mes}
        onChange={(e) => trocar(e.target.value)}
        className="campo w-auto py-1.5"
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
