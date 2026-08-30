import Link from "next/link";
import { Sparkles } from "lucide-react";
import { diasDeTesteRestantes, type PerfilPlano } from "@/lib/planos";

/**
 * Contagem do período de teste.
 *
 * Fica em todas as telas de propósito: é a única peça que lembra a pessoa
 * de que ela está usando algo que vai acabar. Sem esse lembrete, o fim do
 * teste chega como surpresa desagradável em vez de decisão de compra.
 */
export function AvisoTeste({ perfil }: { perfil: PerfilPlano | null | undefined }) {
  const dias = diasDeTesteRestantes(perfil);
  if (dias === 0) return null;

  // Na última semana o tom muda: até então é informação, depois é decisão.
  const urgente = dias <= 7;

  return (
    <Link
      href="/planos"
      className="flex items-center justify-between gap-3 px-4 py-2 text-sm nao-imprimir"
      style={{
        background: urgente ? "rgba(217,164,65,0.14)" : "rgba(47,110,91,0.10)",
        borderBottom: "1px solid var(--borda)",
      }}
    >
      <span className="flex items-center gap-2 min-w-0">
        <Sparkles
          size={15}
          className="shrink-0"
          style={{ color: urgente ? "var(--pendente)" : "var(--positivo)" }}
          aria-hidden
        />
        <span className="truncate">
          {dias === 1
            ? "Último dia com os recursos do Pro"
            : `Você está no Pro por mais ${dias} dias`}
        </span>
      </span>
      <span className="underline shrink-0">Ver planos</span>
    </Link>
  );
}
