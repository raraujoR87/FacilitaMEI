// Relativo com extensão: `lib/` é testado direto pelo runner do Node,
// que não conhece o alias do tsconfig.
import { diasParaDAS } from "./mei.ts";

/**
 * "Quanto desse dinheiro é meu?"
 *
 * É a pergunta que faz o MEI misturar a conta pessoal com a do negócio: ele
 * olha o saldo, não sabe quanto já tem dono (imposto, fornecedor a pagar) e
 * tira no escuro. A conta aqui é deliberadamente conservadora — reserva o
 * imposto antes de dizer o que sobra, porque errar para menos custa um
 * aperto e errar para mais custa uma multa.
 */

export const CATEGORIA_DAS = "DAS (imposto do MEI)";
export const CATEGORIA_RETIRADA = "Retirada do dono";

export type SituacaoDoCaixa = {
  entradas: number;
  saidas: number;
  /** Saídas que já são retirada do dono, separadas do custo do negócio. */
  retiradas: number;
  /** Reservado para o imposto do mês, se ainda não foi pago. */
  reservaDas: number;
  /** O que sobra depois de pagar o negócio e separar o imposto. */
  disponivel: number;
  dasPago: boolean;
  dasInformado: boolean;
};

export function situacaoDoCaixa({
  entradas,
  saidasOperacionais,
  retiradas,
  valorDas,
  dasPago,
}: {
  entradas: number;
  saidasOperacionais: number;
  retiradas: number;
  valorDas: number | null;
  dasPago: boolean;
}): SituacaoDoCaixa {
  const reservaDas = !dasPago && valorDas ? valorDas : 0;

  // Retirada já feita sai do disponível: senão a pessoa tiraria duas vezes
  // o mesmo dinheiro achando que ainda estava lá.
  const disponivel =
    Math.round((entradas - saidasOperacionais - retiradas - reservaDas) * 100) / 100;

  return {
    entradas,
    saidas: saidasOperacionais + retiradas,
    retiradas,
    reservaDas,
    disponivel,
    dasPago,
    dasInformado: valorDas !== null && valorDas > 0,
  };
}

export type AvisoDas = {
  /** Dias até o dia 20. Negativo nunca acontece: rola para o mês seguinte. */
  dias: number;
  urgente: boolean;
  pago: boolean;
};

export function avisoDas(hoje: string, pago: boolean): AvisoDas {
  const dias = diasParaDAS(hoje);
  return { dias, urgente: !pago && dias <= 5, pago };
}
