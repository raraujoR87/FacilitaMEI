"use client";

import { Check, Circle } from "lucide-react";
import { avaliarSenha } from "@/lib/senha";

/**
 * Lista viva dos requisitos, que vai marcando conforme a pessoa digita.
 * Aparece antes do erro do servidor: melhor guiar do que reprovar.
 */
export function RequisitosSenha({ senha }: { senha: string }) {
  const itens = avaliarSenha(senha);
  const faltam = itens.filter((i) => !i.ok).length;

  return (
    <div className="mt-2">
      <p className="dica" aria-live="polite">
        {senha.length === 0
          ? "Sua senha precisa de:"
          : faltam === 0
          ? "Senha válida."
          : `Falta${faltam > 1 ? "m" : ""} ${faltam} requisito${faltam > 1 ? "s" : ""}:`}
      </p>
      <ul className="mt-1 grid gap-0.5">
        {itens.map((item) => (
          <li
            key={item.id}
            className="flex items-center gap-1.5 text-xs"
            style={{ color: item.ok ? "var(--positivo)" : "var(--tinta-suave)" }}
          >
            {item.ok ? (
              <Check size={13} strokeWidth={3} aria-hidden />
            ) : (
              <Circle size={13} strokeWidth={2} aria-hidden />
            )}
            <span>{item.rotulo}</span>
            <span className="sr-only">{item.ok ? "(atendido)" : "(pendente)"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
