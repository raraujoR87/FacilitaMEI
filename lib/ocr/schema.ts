import { z } from "zod";

/**
 * Contrato da extração, compartilhado por todos os provedores de IA.
 *
 * O schema Zod é a fonte única: vira formato de saída estruturada no Claude,
 * JSON Schema no Gemini, e valida a resposta dos dois. Assim, trocar de
 * provedor não muda o que o resto do app recebe.
 */
export const NotaExtraida = z.object({
  descricao: z.string().describe("Descrição curta da compra ou serviço"),
  valor: z
    .number()
    .nullable()
    .describe("Valor total em reais. null se estiver ilegível"),
  data_competencia: z
    .string()
    .nullable()
    .describe("Data do documento em YYYY-MM-DD. null se não houver"),
  fornecedor_cliente: z
    .string()
    .nullable()
    .describe("Nome do fornecedor ou emissor do documento"),
  tipo: z.enum(["receita", "despesa"]),
  categoria_sugerida: z.string(),
  confianca: z
    .enum(["alta", "media", "baixa"])
    .describe("Quão legível estava o documento"),
});

export type NotaExtraida = z.infer<typeof NotaExtraida>;

export const CATEGORIAS_CONHECIDAS = [
  "Vendas",
  "Serviços",
  "Fornecedores",
  "Material de trabalho",
  "Transporte",
  "Alimentação",
  "Impostos e taxas",
  "Outros",
];

export const INSTRUCOES = `Você lê documentos financeiros brasileiros para um MEI: notas fiscais, cupons, recibos e boletos.

Extraia os dados do documento na imagem.

Regras:
- O valor é o TOTAL pago, não o subtotal nem o valor de um item isolado.
- Documentos brasileiros usam vírgula decimal: "1.234,56" são mil duzentos e trinta e quatro reais e cinquenta e seis centavos.
- Classifique como "receita" apenas se o MEI foi quem RECEBEU o dinheiro (ex: um recibo emitido por ele). Compras e cupons de consumo são "despesa".
- Use preferencialmente uma destas categorias: ${CATEGORIAS_CONHECIDAS.join(", ")}. Só invente outra se nenhuma servir.
- Se o documento estiver borrado, cortado ou ilegível, marque confianca "baixa" em vez de adivinhar valores.`;

export const PEDIDO = "Extraia os dados deste documento.";

/** Formatos de imagem aceitos pelos dois provedores. PDF entra como documento. */
const TIPOS_IMAGEM = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

export function ehImagemSuportada(mediaType: string): boolean {
  return (TIPOS_IMAGEM as readonly string[]).includes(mediaType);
}

/** A foto não deu para ler — erro do usuário, não da infraestrutura. */
export class NotaIlegivelError extends Error {}

/** O provedor falhou (sem chave, fora do ar, cota estourada). */
export class ProvedorIndisponivelError extends Error {
  // Campos declarados e atribuídos explicitamente: propriedade de parâmetro
  // (`constructor(public readonly ...)`) gera código e não passa no modo de
  // remoção de tipos do Node, usado para rodar os testes sem build.
  readonly provedor: string;
  readonly causa?: unknown;

  constructor(provedor: string, mensagem: string, causa?: unknown) {
    super(mensagem);
    this.name = "ProvedorIndisponivelError";
    this.provedor = provedor;
    this.causa = causa;
  }
}

export type Provedor = "claude" | "gemini";

/** Assinatura que todo provedor implementa. */
export type LeitorDeNota = (
  conteudo: Buffer,
  mediaType: string
) => Promise<NotaExtraida>;
