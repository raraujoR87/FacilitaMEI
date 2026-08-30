/**
 * Contas fixas: aluguel, internet, telefone, contador.
 *
 * É o gasto que o MEI mais esquece de lançar, justamente por ser o mais
 * previsível — ninguém guarda o boleto da internet. O efeito é que
 * "quanto desse dinheiro é seu" fica otimista no fim do mês, que é quando
 * as contas chegam.
 *
 * O app não lança sozinho de propósito: dinheiro que o sistema inventa é
 * dinheiro em que o dono não confia. Ele lembra e deixa a um toque.
 */

export type ContaFixa = {
  id: string;
  descricao: string;
  valor: number;
  dia_vencimento: number | null;
  categoria_id: string | null;
  categoria: string | null;
  /** Preenchido quando já existe lançamento desta conta no mês consultado. */
  lancamento_id: string | null;
  valor_lancado: number | null;
  lancado_em: string | null;
};

export function jaLancada(c: ContaFixa): boolean {
  return c.lancamento_id !== null;
}

export type ResumoFixas = {
  pendentes: ContaFixa[];
  lancadas: ContaFixa[];
  /** Soma do que ainda não foi lançado — o buraco no caixa do mês. */
  aLancar: number;
  /** O que já entrou nas contas do mês, pelo valor real lançado. */
  lancado: number;
};

export function resumirFixas(contas: ContaFixa[]): ResumoFixas {
  const pendentes = contas.filter((c) => !jaLancada(c));
  const lancadas = contas.filter(jaLancada);

  return {
    pendentes,
    lancadas,
    aLancar: pendentes.reduce((s, c) => s + Number(c.valor), 0),
    // Pelo valor lançado, não pelo previsto: conta de luz muda todo mês, e
    // somar o previsto mostraria um total que não bate com o extrato.
    lancado: lancadas.reduce((s, c) => s + Number(c.valor_lancado ?? 0), 0),
  };
}

/**
 * Se a conta já passou do vencimento neste mês.
 *
 * Só vale para o mês corrente: olhar um mês passado e ver tudo "atrasado"
 * seria alarme falso sobre algo que não dá mais para resolver.
 */
export function venceuNoMes(
  c: ContaFixa,
  mes: string,
  hojeISO: string
): boolean {
  if (c.dia_vencimento === null || jaLancada(c)) return false;
  if (mes !== hojeISO.slice(0, 7)) return false;
  return Number(hojeISO.slice(8, 10)) > c.dia_vencimento;
}

/** "vence dia 10" comunica melhor que um número solto. */
export function descreverVencimento(c: ContaFixa): string {
  return c.dia_vencimento === null
    ? "sem dia fixo"
    : `vence dia ${c.dia_vencimento}`;
}
