/**
 * Orçamento: a proposta, antes de virar dinheiro.
 *
 * A distinção que organiza tudo aqui: recibo registra o que já aconteceu,
 * orçamento propõe o que pode acontecer. Um entra no caixa, o outro não —
 * e misturar os dois foi o que inflava "A receber" com valor que ninguém
 * se comprometeu a pagar.
 */

/** Quantos dias o preço costuma valer, quando a pessoa não escolhe. */
export const VALIDADE_PADRAO_DIAS = 15;

export type SituacaoOrcamento =
  | "rascunho"
  | "aguardando"
  | "aceito"
  | "vencido"
  | "convertido"
  | "recusado";

export type Orcamento = {
  id: string;
  numero: number;
  descricao_servico: string;
  valor: number;
  desconto: number;
  status: string;
  data_emissao: string;
  validade_em: string | null;
  aceito_em: string | null;
  aceito_por: string | null;
  token_publico: string | null;
};

/**
 * A situação que decide o que fazer com a proposta.
 *
 * Vencido é calculado, não guardado: uma coluna de status precisaria de
 * alguém rodando todo dia para virar, e enquanto ninguém rodasse o
 * orçamento apareceria válido depois do prazo — justamente o erro que a
 * validade existe para evitar.
 */
export function situacaoDoOrcamento(o: Orcamento, hojeISO: string): SituacaoOrcamento {
  if (o.status === "cancelado") return "recusado";
  if (o.status === "convertido" || o.status === "pago") return "convertido";
  if (o.aceito_em) return "aceito";
  if (!o.token_publico) return "rascunho";
  if (venceu(o.validade_em, hojeISO)) return "vencido";
  return "aguardando";
}

/**
 * Compara data como texto, sem `new Date()`.
 *
 * Já mordeu antes: `new Date("2026-08-01")` é meia-noite UTC, que em
 * Brasília ainda é 31/07 — e o orçamento vencia um dia antes do combinado.
 */
export function venceu(validade: string | null, hojeISO: string): boolean {
  if (!validade) return false;
  return validade.slice(0, 10) < hojeISO.slice(0, 10);
}

/** Dias que faltam. Negativo é quanto já passou. */
export function diasDeValidade(validade: string | null, hojeISO: string): number | null {
  if (!validade) return null;
  const [a1, m1, d1] = validade.slice(0, 10).split("-").map(Number);
  const [a2, m2, d2] = hojeISO.slice(0, 10).split("-").map(Number);
  return Math.round(
    (Date.UTC(a1, m1 - 1, d1) - Date.UTC(a2, m2 - 1, d2)) / 86_400_000
  );
}

export const ROTULO_ORCAMENTO: Record<
  SituacaoOrcamento,
  { texto: string; cor: string }
> = {
  rascunho: { texto: "rascunho", cor: "var(--tinta-suave)" },
  aguardando: { texto: "aguardando resposta", cor: "var(--pendente)" },
  aceito: { texto: "aceito", cor: "var(--positivo)" },
  vencido: { texto: "validade vencida", cor: "var(--selo)" },
  convertido: { texto: "virou recibo", cor: "var(--positivo)" },
  recusado: { texto: "cancelado", cor: "var(--tinta-suave)" },
};

export type ItemOrcamento = {
  descricao: string;
  quantidade: number;
  unidade: string;
  valor_unitario: number;
  total: number;
};

export type Totais = {
  subtotal: number;
  desconto: number;
  total: number;
  /** Percentual do desconto sobre o subtotal, para exibir na proposta. */
  percentualDesconto: number | null;
};

/**
 * O fechamento da proposta.
 *
 * O total sai daqui e não da soma solta: com desconto, o valor dos itens
 * deixa de ser o que o cliente paga, e ter duas verdades num documento de
 * preço é como o PIX acaba cobrando diferente do que está escrito.
 */
export function calcularTotais(itens: ItemOrcamento[], desconto: number): Totais {
  const subtotal = Math.round(itens.reduce((s, i) => s + Number(i.total), 0) * 100) / 100;
  const abatimento = Math.min(Math.max(desconto, 0), subtotal);
  const total = Math.round((subtotal - abatimento) * 100) / 100;

  return {
    subtotal,
    desconto: abatimento,
    total,
    percentualDesconto:
      subtotal > 0 && abatimento > 0
        ? Math.round((abatimento / subtotal) * 1000) / 10
        : null,
  };
}

/** Data de validade sugerida a partir da emissão. */
export function validadeSugerida(emissaoISO: string, dias = VALIDADE_PADRAO_DIAS): string {
  const [ano, mes, dia] = emissaoISO.slice(0, 10).split("-").map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia + dias));
  return d.toISOString().slice(0, 10);
}
