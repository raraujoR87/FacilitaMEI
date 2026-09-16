/**
 * Catálogo de produtos e serviços.
 *
 * O que se vende, cadastrado uma vez e reusado em recibo e orçamento. O
 * atrito que ele resolve aparece todo dia: "Corte masculino — R$ 45"
 * redigitado a cada atendimento.
 *
 * O `custo` aqui é o que faz a margem existir sem trabalho: antes, saber
 * se um trabalho deu lucro exigia lançar a despesa e vinculá-la à mão.
 */

/** Teto do plano grátis. Ver o porquê do número na migration 0026. */
export const LIMITE_CATALOGO_FREE = 15;

export type ItemCatalogo = {
  id: string;
  nome: string;
  natureza: "servico" | "produto";
  preco: number;
  custo: number;
  unidade: string;
  arquivado_em: string | null;
};

/** Linha de um documento, com o custo já fotografado na emissão. */
export type ItemComCusto = {
  quantidade: number;
  valor_unitario: number;
  custo_unitario: number;
};

/**
 * Quanto os itens custaram.
 *
 * Arredonda por linha antes de somar, igual à coluna gerada no banco —
 * senão tela e documento divergem de centavo.
 */
export function custoDosItens(itens: ItemComCusto[]): number {
  return (
    Math.round(
      itens.reduce(
        (soma, i) => soma + Math.round(Number(i.quantidade) * Number(i.custo_unitario) * 100) / 100,
        0
      ) * 100
    ) / 100
  );
}

/**
 * As duas origens de custo de um trabalho.
 *
 * Elas existem por motivos diferentes e não se substituem: o catálogo sabe
 * o custo do que foi vendido, e a despesa vinculada cobre o que não estava
 * no catálogo — o frete, o ajudante, a peça comprada só para aquela obra.
 *
 * Ficam separadas na hora de mostrar porque somá-las em silêncio esconderia
 * uma dupla contagem: quem cadastra o custo no catálogo E lança a compra
 * vinculada ao mesmo trabalho veria a margem afundar sem entender por quê.
 */
export type ComposicaoDeCusto = {
  dosItens: number;
  deDespesas: number;
  total: number;
  /** Verdadeiro quando as duas origens têm valor — sinal de dupla contagem. */
  podeEstarDuplicado: boolean;
};

export function comporCusto(
  itens: ItemComCusto[],
  despesasVinculadas: number
): ComposicaoDeCusto {
  const dosItens = custoDosItens(itens);
  const deDespesas = Math.max(despesasVinculadas, 0);

  return {
    dosItens,
    deDespesas,
    total: Math.round((dosItens + deDespesas) * 100) / 100,
    podeEstarDuplicado: dosItens > 0 && deDespesas > 0,
  };
}

/**
 * Margem de um item do catálogo, para a lista.
 *
 * Sem custo cadastrado devolve `null` em vez de 100%: "não sei o custo" é
 * diferente de "não teve custo", e mostrar margem cheia daria uma certeza
 * que o dado não tem.
 */
export function margemDoItem(item: ItemCatalogo): number | null {
  if (item.custo <= 0 || item.preco <= 0) return null;
  return Math.round(((item.preco - item.custo) / item.preco) * 1000) / 10;
}

/** Ordena serviços antes de produtos, e alfabético dentro de cada grupo. */
export function ordenarCatalogo(itens: ItemCatalogo[]): ItemCatalogo[] {
  return [...itens].sort((a, b) => {
    if (a.natureza !== b.natureza) return a.natureza === "servico" ? -1 : 1;
    return a.nome.localeCompare(b.nome, "pt-BR");
  });
}
