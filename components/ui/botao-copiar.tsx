"use client";

import { useState } from "react";

export function BotaoCopiar({
  texto,
  rotulo = "Copiar código PIX",
}: {
  texto: string;
  rotulo?: string;
}) {
  const [estado, setEstado] = useState<"parado" | "copiado" | "falhou">("parado");

  async function copiar() {
    try {
      // Exige contexto seguro (https ou localhost); fora disso o navegador recusa.
      await navigator.clipboard.writeText(texto);
      setEstado("copiado");
      setTimeout(() => setEstado("parado"), 2500);
    } catch {
      setEstado("falhou");
    }
  }

  return (
    <div>
      <button type="button" onClick={copiar} className="botao botao-secundario">
        {estado === "copiado" ? "Copiado ✓" : rotulo}
      </button>
      {estado === "falhou" && (
        <p className="dica">
          O navegador bloqueou a cópia. Selecione o código acima e copie manualmente.
        </p>
      )}
    </div>
  );
}
