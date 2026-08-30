/**
 * Vocabulário das saídas de dinheiro.
 *
 * Todo dinheiro que sai é um `lancamento` com `tipo = 'despesa'`; o que
 * muda é a NATUREZA. A distinção não é cosmética — cada uma entra numa
 * conta diferente:
 *
 * - custo    → reduz o lucro do negócio
 * - retirada → não é custo, é destino do lucro (sai do "quanto é meu")
 * - imposto  → o DAS, que já estava reservado antes de ser pago
 *
 * Antes isso era decidido comparando o NOME da categoria como texto. Como
 * categoria é rótulo que o usuário edita, renomear "Retirada do dono" para
 * "Pró-labore" quebrava o cálculo do caixa em silêncio. Agora categoria é
 * rótulo e natureza é dado.
 */

export const NATUREZAS_SAIDA = ["custo", "retirada", "imposto"] as const;
export type NaturezaSaida = (typeof NATUREZAS_SAIDA)[number];

export function ehNaturezaSaida(valor: string): valor is NaturezaSaida {
  return (NATUREZAS_SAIDA as readonly string[]).includes(valor);
}

type Descricao = {
  /** Como a pessoa chama isso, não como o contador chama. */
  rotulo: string;
  ajuda: string;
  /** Categoria criada no cadastro da conta, usada como rótulo padrão. */
  categoriaPadrao: string | null;
  /** Se pode ser atribuída a um trabalho para calcular margem. */
  aceitaVinculo: boolean;
};

export const SAIDA: Record<NaturezaSaida, Descricao> = {
  custo: {
    rotulo: "Custo do negócio",
    ajuda: "Material, fornecedor, transporte — o que o trabalho consumiu.",
    categoriaPadrao: null,
    aceitaVinculo: true,
  },
  retirada: {
    rotulo: "Retirada minha",
    ajuda:
      "Dinheiro que você tirou para uso pessoal. Não é custo: é o lucro indo para o seu bolso.",
    categoriaPadrao: "Retirada do dono",
    aceitaVinculo: false,
  },
  imposto: {
    rotulo: "Imposto (DAS)",
    ajuda:
      "O DAS do mês. Fica na competência a que ele se refere, não no dia em que foi pago.",
    categoriaPadrao: "DAS (imposto do MEI)",
    aceitaVinculo: false,
  },
};

/**
 * Descrição padrão quando a pessoa não escreve nada.
 *
 * Retirada e DAS não pedem descrição na tela — obrigar a digitar "DAS de
 * agosto" todo mês é atrito num registro que deveria ser de um toque.
 */
export function descricaoPadrao(
  natureza: NaturezaSaida,
  competencia: string
): string {
  if (natureza === "imposto") {
    return `DAS de ${competencia.slice(5, 7)}/${competencia.slice(0, 4)}`;
  }
  if (natureza === "retirada") return "Retirada do dono";
  return "";
}
