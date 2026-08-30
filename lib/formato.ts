// Formatação pt-BR compartilhada por telas e relatórios.

const MOEDA = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const FUSO_BR = "America/Sao_Paulo";

export function formatarMoeda(valor: number): string {
  return MOEDA.format(valor);
}

/**
 * Datas do Postgres chegam como "YYYY-MM-DD". `new Date("2026-08-29")` é lido
 * como meia-noite UTC — que no fuso do Brasil ainda é dia 28. Por isso a data
 * é quebrada em partes em vez de passar pelo construtor de Date.
 */
export function formatarData(data: string): string {
  const [ano, mes, dia] = data.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

/**
 * Data de um instante (`timestamptz`) no fuso do Brasil.
 *
 * Diferente de `formatarData`, que recebe uma coluna `date` já sem fuso.
 * Fatiar a string ISO de um timestamptz devolveria a data em UTC: um
 * cadastro feito às 21h de 29/08 em São Paulo apareceria como 30/08.
 */
export function formatarDataDoMomento(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO_BR,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

/** Data de hoje no fuso do Brasil — o servidor da Vercel roda em UTC. */
export function hoje(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO_BR }).format(
    new Date()
  );
}

/** Competência atual no formato "YYYY-MM". */
export function mesAtual(): string {
  return hoje().slice(0, 7);
}

/** "2026-08" → "agosto de 2026" */
export function rotuloMes(mes: string): string {
  const [ano, mesNum] = mes.split("-").map(Number);
  return new Date(Date.UTC(ano, mesNum - 1, 1)).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Primeiro e último dia do mês, prontos para filtro no Postgres. */
export function intervaloDoMes(mes: string): { inicio: string; fim: string } {
  const [ano, mesNum] = mes.split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(ano, mesNum, 0)).getUTCDate();
  return {
    inicio: `${mes}-01`,
    fim: `${mes}-${String(ultimoDia).padStart(2, "0")}`,
  };
}

/** Os N meses mais recentes, do atual para trás — alimenta o seletor de período. */
export function ultimosMeses(quantidade: number): string[] {
  const [ano, mes] = mesAtual().split("-").map(Number);
  return Array.from({ length: quantidade }, (_, i) => {
    const d = new Date(Date.UTC(ano, mes - 1 - i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

/** Centavos → "1.234,56" (sem o símbolo, para uso dentro de campos de entrada). */
export function formatarCentavos(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function estaVencido(dataVencimento: string | null): boolean {
  return dataVencimento !== null && dataVencimento.slice(0, 10) < hoje();
}

/**
 * Lê um número digitado em pt-BR, onde a vírgula é o separador decimal.
 *
 * Existe porque `Number("7,5")` é NaN: o componente convertia a vírgula e a
 * Server Action não, então um item com quantidade fracionária era descartado
 * silenciosamente e o recibo saía com valor menor que o combinado.
 */
export function lerNumeroBR(texto: string): number {
  const n = Number(String(texto).trim().replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
