/**
 * Regras de nota fiscal do MEI.
 *
 * O AgilizeMei não emite nota — emissão é ato do contribuinte, feita no
 * Emissor Nacional (serviço) ou na SEFAZ estadual (produto). O que fazemos
 * é dizer, para cada entrada, se a nota é obrigatória e onde emitir.
 *
 * Base normativa (confirmada em fontes oficiais, não de memória):
 * - LC 123/2006 e Resolução CGSN 140/2018: o MEI é dispensado de emitir
 *   documento fiscal para consumidor pessoa física, e obrigado quando o
 *   destinatário é pessoa jurídica.
 * - Resolução CGSN 191, de 04/08/2026: a emissão de NFS-e pelo Emissor
 *   Nacional, que valeria desde 01/09/2026, passou a valer em 01/11/2026.
 *   https://www.gov.br/nfse/pt-br/noticias/comite-gestor-do-simples-nacional-prorroga-a-obrigatoriedade-de-emissao-de-notas-fiscais-de-servico-pelo-emissor-nacional-da-nfs-e
 *
 * Regra fiscal muda. Estas datas e obrigações precisam ser revisadas junto
 * com um contador antes de cada temporada de mudança.
 */

export type Natureza = "servico" | "produto";
export type TipoPessoa = "fisica" | "juridica" | "sem_documento";

/** Data em que o Emissor Nacional passa a ser o único caminho para NFS-e. */
export const PRAZO_EMISSOR_NACIONAL = "2026-11-01";

export const PORTAL_NFSE = "https://www.nfse.gov.br";
export const PORTAL_EMISSOR_NACIONAL = "https://www.nfse.gov.br/EmissorNacional";

/** Só dígitos, que é como o documento é guardado. */
export function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

export function tipoPessoa(documento: string | null | undefined): TipoPessoa {
  const digitos = apenasDigitos(documento ?? "");
  if (digitos.length === 11) return "fisica";
  if (digitos.length === 14) return "juridica";
  return "sem_documento";
}

/** Cálculo do dígito verificador por módulo 11, comum a CPF e CNPJ. */
function digitoModulo11(base: string, pesos: number[]): number {
  const soma = base
    .split("")
    .reduce((acc, digito, i) => acc + Number(digito) * pesos[i], 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function cpfValido(documento: string): boolean {
  const d = apenasDigitos(documento);
  if (d.length !== 11) return false;
  // Sequências repetidas passam no módulo 11 mas não existem na Receita.
  if (/^(\d)\1{10}$/.test(d)) return false;

  const primeiro = digitoModulo11(d.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const segundo = digitoModulo11(d.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return primeiro === Number(d[9]) && segundo === Number(d[10]);
}

export function cnpjValido(documento: string): boolean {
  const d = apenasDigitos(documento);
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;

  const primeiro = digitoModulo11(d.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const segundo = digitoModulo11(d.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return primeiro === Number(d[12]) && segundo === Number(d[13]);
}

export function documentoValido(documento: string): boolean {
  const d = apenasDigitos(documento);
  if (d.length === 11) return cpfValido(d);
  if (d.length === 14) return cnpjValido(d);
  return false;
}

export function formatarDocumento(documento: string | null | undefined): string {
  const d = apenasDigitos(documento ?? "");
  if (d.length === 11) {
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  if (d.length === 14) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }
  return documento ?? "";
}

export type SituacaoFiscal = {
  /** true quando a lei obriga a emissão para esta combinação. */
  obrigatoria: boolean;
  /** Documento a emitir, quando houver. */
  documento: "NFS-e" | "NF-e" | null;
  /** Frase curta para a interface. */
  resumo: string;
  /** Explicação com a razão da regra. */
  detalhe: string;
};

/**
 * Diz se aquela entrada exige nota fiscal.
 *
 * O gatilho é o destinatário, não o valor: venda para CNPJ obriga, venda
 * para pessoa física não. Sem o documento do cliente cadastrado, o app não
 * tem como decidir — e dizer "não precisa" nesse caso seria pior do que
 * admitir que falta informação.
 */
export function situacaoFiscal(
  natureza: Natureza,
  documentoCliente: string | null | undefined
): SituacaoFiscal {
  const pessoa = tipoPessoa(documentoCliente);
  const documento = natureza === "servico" ? "NFS-e" : "NF-e";

  if (pessoa === "sem_documento") {
    return {
      obrigatoria: false,
      documento: null,
      resumo: "Falta o CPF ou CNPJ do cliente",
      detalhe:
        "Sem o documento do cliente não dá para saber se a nota é obrigatória. Cadastre o CPF ou CNPJ para o AgilizeMei avisar.",
    };
  }

  if (pessoa === "juridica") {
    return {
      obrigatoria: true,
      documento,
      resumo: `${documento} obrigatória`,
      detalhe:
        natureza === "servico"
          ? "Serviço prestado para empresa (CNPJ): o MEI é obrigado a emitir NFS-e."
          : "Venda de produto para empresa (CNPJ): a nota é obrigatória, salvo se o comprador emitir nota de entrada.",
    };
  }

  return {
    obrigatoria: false,
    documento,
    resumo: "Nota não obrigatória",
    detalhe:
      "Cliente pessoa física: o MEI é dispensado de emitir nota fiscal. Você pode emitir mesmo assim, se o cliente pedir.",
  };
}

/** Dias que faltam para o Emissor Nacional virar obrigatório. Negativo = já venceu. */
export function diasParaEmissorNacional(hoje: string): number {
  const alvo = Date.parse(`${PRAZO_EMISSOR_NACIONAL}T00:00:00Z`);
  const agora = Date.parse(`${hoje}T00:00:00Z`);
  return Math.round((alvo - agora) / 86_400_000);
}
