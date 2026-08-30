"use client";

import { useFormStatus } from "react-dom";

/**
 * Precisa ser um componente separado do formulário: `useFormStatus` só
 * enxerga o envio quando é lido de dentro de um filho do `<form>`.
 */
export function BotaoSubmit({
  children,
  carregando = "Salvando...",
  variante,
}: {
  children: React.ReactNode;
  carregando?: string;
  variante?: "secundario" | "discreto";
}) {
  const { pending } = useFormStatus();
  const classe =
    variante === "secundario"
      ? "botao botao-secundario"
      : variante === "discreto"
      ? "botao botao-discreto"
      : "botao";

  return (
    <button type="submit" disabled={pending} className={classe}>
      {pending ? carregando : children}
    </button>
  );
}
