/**
 * Teto de faturamento do MEI.
 *
 * O AgilizeMei conhece o faturamento do cliente em tempo real — é a única
 * ferramenta dele que conhece. Estourar o teto sem perceber é o maior medo
 * de quem é MEI, porque acima de 20% o desenquadramento é retroativo ao
 * início do ano e a conta vem como Microempresa.
 *
 * Fontes (confirmadas em gov.br, não escritas de memória):
 * - Teto de R$ 81.000 vigente em 2026, com progressão para R$ 110.000 em
 *   2027 e R$ 140.000 em 2028.
 *   https://www.gov.br/memp/pt-br/teto-do-mei
 * - No ano de abertura o limite é proporcional: R$ 6.750,00 (81.000/12) por
 *   mês, do mês de abertura até dezembro, contando fração de mês como mês
 *   inteiro. Abrindo em junho, o limite do ano é 7 x 6.750 = R$ 47.250.
 *   https://www.gov.br/empresas-e-negocios/pt-br/empreendedor/perguntas-frequentes/o-que-e-o-microempreendedor-individual-mei/qual-o-faturamento-anual-do
 * - Até 20% acima do teto: DAS complementar e passa a Microempresa no ano
 *   seguinte. Acima de 20%: desenquadramento retroativo ao início do ano.
 *
 * Valores de anos futuros vêm de norma já publicada, mas regra fiscal muda:
 * revisar com contador a cada virada de ano.
 */

/** Teto anual por ano-calendário. */
const TETOS: Record<number, number> = {
  2026: 81_000,
  2027: 110_000,
  2028: 140_000,
};

/** Margem de tolerância antes do desenquadramento retroativo. */
export const TOLERANCIA = 0.2;

export function tetoDoAno(ano: number): number {
  const anosConhecidos = Object.keys(TETOS).map(Number);
  if (TETOS[ano]) return TETOS[ano];

  // Antes do primeiro ano tabelado, vale o teto mais antigo conhecido;
  // depois do último, o mais recente. Melhor que devolver zero e assustar
  // o usuário com "você estourou o teto".
  const menor = Math.min(...anosConhecidos);
  const maior = Math.max(...anosConhecidos);
  return ano < menor ? TETOS[menor] : TETOS[maior];
}

/**
 * Teto aplicável, já considerando abertura no meio do ano.
 *
 * `dataAbertura` em "YYYY-MM-DD". Fora do ano de abertura, o teto é cheio.
 */
export function tetoAplicavel(ano: number, dataAbertura?: string | null): number {
  const teto = tetoDoAno(ano);
  if (!dataAbertura) return teto;

  const [anoAbertura, mesAbertura] = dataAbertura.slice(0, 10).split("-").map(Number);
  if (anoAbertura !== ano) return teto;

  // Do mês de abertura até dezembro, fração de mês conta como mês inteiro.
  const meses = 13 - mesAbertura;
  return Math.round((teto / 12) * meses * 100) / 100;
}

export type FaixaTeto = "tranquilo" | "atencao" | "limite" | "estourado" | "grave";

export type SituacaoTeto = {
  faturado: number;
  teto: number;
  /** Quanto do teto já foi usado, de 0 a 100 (pode passar de 100). */
  percentual: number;
  restante: number;
  faixa: FaixaTeto;
  resumo: string;
  detalhe: string;
  /** Valor a partir do qual o desenquadramento vira retroativo. */
  limiteRetroativo: number;
};

export function situacaoTeto(
  faturado: number,
  ano: number,
  dataAbertura?: string | null
): SituacaoTeto {
  const teto = tetoAplicavel(ano, dataAbertura);
  const limiteRetroativo = Math.round(teto * (1 + TOLERANCIA) * 100) / 100;
  const percentual = teto > 0 ? Math.round((faturado / teto) * 1000) / 10 : 0;
  const restante = Math.round((teto - faturado) * 100) / 100;

  if (faturado > limiteRetroativo) {
    return {
      faturado, teto, percentual, restante, limiteRetroativo, faixa: "grave",
      resumo: "Você passou mais de 20% do teto",
      detalhe:
        "Nessa faixa o desenquadramento é retroativo ao início do ano: os impostos são recalculados como Microempresa desde janeiro. Procure seu contador esta semana.",
    };
  }

  if (faturado > teto) {
    return {
      faturado, teto, percentual, restante, limiteRetroativo, faixa: "estourado",
      resumo: "Você passou do teto",
      detalhe:
        "Até 20% acima do teto você paga um DAS complementar sobre o excedente e passa a Microempresa no ano que vem. Passando de 20%, o desenquadramento vira retroativo. Fale com seu contador.",
    };
  }

  if (percentual >= 90) {
    return {
      faturado, teto, percentual, restante, limiteRetroativo, faixa: "limite",
      resumo: "Falta pouco para o teto",
      detalhe:
        "Sobrou pouco para faturar como MEI neste ano. Vale conversar com seu contador agora sobre virar Microempresa, antes de precisar.",
    };
  }

  if (percentual >= 75) {
    return {
      faturado, teto, percentual, restante, limiteRetroativo, faixa: "atencao",
      resumo: "Atenção ao teto",
      detalhe:
        "Você já usou boa parte do limite do ano. Vale acompanhar de perto para não ser pego de surpresa em dezembro.",
    };
  }

  return {
    faturado, teto, percentual, restante, limiteRetroativo, faixa: "tranquilo",
    resumo: "Dentro do teto",
    detalhe: "Faturamento confortável para o limite do MEI neste ano.",
  };
}

/** Cor da faixa, para a barra e o texto. */
export function corDaFaixa(faixa: FaixaTeto): string {
  switch (faixa) {
    case "grave":
    case "estourado":
      return "var(--selo)";
    case "limite":
      return "var(--pendente)";
    case "atencao":
      return "var(--pendente)";
    default:
      return "var(--positivo)";
  }
}

/**
 * Dia de vencimento do DAS-MEI: dia 20 do mês seguinte ao da apuração.
 * Quando cai em fim de semana ou feriado, prorroga para o dia útil
 * seguinte — a checagem de feriado fica com o cliente, aqui só o dia 20.
 */
export const DIA_VENCIMENTO_DAS = 20;

export function diasParaDAS(hoje: string): number {
  const [ano, mes, dia] = hoje.slice(0, 10).split("-").map(Number);
  const venceEsteMes = dia <= DIA_VENCIMENTO_DAS;
  const alvo = Date.UTC(
    venceEsteMes ? ano : mes === 12 ? ano + 1 : ano,
    venceEsteMes ? mes - 1 : mes % 12,
    DIA_VENCIMENTO_DAS
  );
  return Math.round((alvo - Date.UTC(ano, mes - 1, dia)) / 86_400_000);
}
