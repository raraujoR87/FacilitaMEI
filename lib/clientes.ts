/**
 * Leitura da carteira de clientes.
 *
 * O MEI não precisa de relatório: precisa saber a quem ligar hoje. As
 * faixas abaixo existem para transformar número em ação.
 */

export type MetricaCliente = {
  cliente_id: string;
  nome: string;
  documento: string | null;
  telefone: string | null;
  documentos: number;
  total_pago: number;
  total_aberto: number;
  total_vencido: number;
  ticket_medio: number;
  primeira_compra: string | null;
  ultima_compra: string | null;
  dias_desde_ultima: number | null;
  intervalo_medio_dias: number | null;
  pagou_com_atraso: number;
};

/** Depois de quantos dias sem comprar o cliente merece um telefonema. */
export const DIAS_PARA_SUMIDO = 60;

export type Situacao = "devendo" | "sumido" | "recorrente" | "novo" | "inativo";

/**
 * A situação que decide a ação da semana.
 *
 * Devendo vem primeiro: dinheiro parado é mais urgente que oportunidade.
 * "Sumido" só vale para quem já comprou mais de uma vez — quem comprou uma
 * vez e não voltou pode nunca ter sido cliente de verdade, e tratar como
 * perda gera cobrança fora de hora.
 */
export function situacaoDoCliente(m: MetricaCliente): Situacao {
  if (m.total_vencido > 0) return "devendo";
  if (m.documentos === 0) return "novo";

  const sumiu =
    m.dias_desde_ultima !== null && m.dias_desde_ultima > DIAS_PARA_SUMIDO;

  if (sumiu) return m.documentos > 1 ? "sumido" : "inativo";
  return m.documentos > 1 ? "recorrente" : "novo";
}

export const ROTULO_SITUACAO: Record<Situacao, { texto: string; cor: string }> = {
  devendo: { texto: "devendo", cor: "var(--selo)" },
  sumido: { texto: "sumiu", cor: "var(--pendente)" },
  recorrente: { texto: "recorrente", cor: "var(--positivo)" },
  novo: { texto: "novo", cor: "var(--tinta-suave)" },
  inativo: { texto: "sem retorno", cor: "var(--tinta-suave)" },
};

/** "a cada 23 dias" comunica melhor que um número solto. */
export function descreverRecorrencia(m: MetricaCliente): string {
  if (m.documentos <= 1 || m.intervalo_medio_dias === null) return "primeira compra";
  const d = m.intervalo_medio_dias;
  if (d <= 10) return `volta a cada ${d} dias`;
  if (d <= 45) return `volta a cada ${Math.round(d / 7)} semanas`;
  return `volta a cada ${Math.round(d / 30)} meses`;
}
