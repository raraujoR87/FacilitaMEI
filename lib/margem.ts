/**
 * Margem por serviço.
 *
 * Faturamento alto com margem baixa é a armadilha clássica: o MEI comemora
 * o cliente grande sem perceber que o material consumiu quase tudo. Quem
 * mais fatura e quem mais dá lucro raramente são a mesma pessoa.
 */

export type Margem = {
  receita: number;
  custo: number;
  lucro: number;
  /** Percentual do que sobrou. null quando não há receita para dividir. */
  percentual: number | null;
  /** true quando nenhum custo foi atribuído — não é margem de 100%. */
  semCustoAtribuido: boolean;
};

export function calcularMargem(receita: number, custo: number): Margem {
  const lucro = Math.round((receita - custo) * 100) / 100;

  return {
    receita,
    custo,
    lucro,
    percentual: receita > 0 ? Math.round((lucro / receita) * 1000) / 10 : null,
    // Distinção que importa: "não sei o custo" é diferente de "não teve
    // custo". Mostrar 100% de margem para um serviço sem despesa lançada
    // seria dar uma certeza que o dado não tem.
    semCustoAtribuido: custo === 0,
  };
}

export type FaixaMargem = "boa" | "apertada" | "prejuizo" | "desconhecida";

export function faixaDaMargem(m: Margem): FaixaMargem {
  if (m.semCustoAtribuido) return "desconhecida";
  if (m.lucro < 0) return "prejuizo";
  return (m.percentual ?? 0) < 30 ? "apertada" : "boa";
}

export function corDaMargem(faixa: FaixaMargem): string {
  switch (faixa) {
    case "prejuizo":
      return "var(--selo)";
    case "apertada":
      return "var(--pendente)";
    case "boa":
      return "var(--positivo)";
    default:
      return "var(--tinta-suave)";
  }
}
