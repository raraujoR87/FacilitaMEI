import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { hoje } from "@/lib/formato";

/**
 * Extração de nota fiscal / recibo / boleto por visão.
 *
 * Fica fora da rota HTTP porque o webhook do WhatsApp precisa exatamente do
 * mesmo comportamento — a foto chega por outro canal, o resultado é o mesmo.
 */

// O schema é a garantia do formato: a resposta vem validada em vez de
// depender do modelo obedecer a uma instrução de "responda só JSON".
const NotaExtraida = z.object({
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

const CATEGORIAS_CONHECIDAS = [
  "Vendas",
  "Serviços",
  "Fornecedores",
  "Material de trabalho",
  "Transporte",
  "Alimentação",
  "Impostos e taxas",
  "Outros",
];

const INSTRUCOES = `Você lê documentos financeiros brasileiros para um MEI: notas fiscais, cupons, recibos e boletos.

Extraia os dados do documento na imagem.

Regras:
- O valor é o TOTAL pago, não o subtotal nem o valor de um item isolado.
- Documentos brasileiros usam vírgula decimal: "1.234,56" são mil duzentos e trinta e quatro reais e cinquenta e seis centavos.
- Classifique como "receita" apenas se o MEI foi quem RECEBEU o dinheiro (ex: um recibo emitido por ele). Compras e cupons de consumo são "despesa".
- Use preferencialmente uma destas categorias: ${CATEGORIAS_CONHECIDAS.join(", ")}. Só invente outra se nenhuma servir.
- Se o documento estiver borrado, cortado ou ilegível, marque confianca "baixa" em vez de adivinhar valores.`;

/** Formatos de imagem que a API aceita. PDF entra por outro caminho. */
const TIPOS_IMAGEM = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type TipoImagem = (typeof TIPOS_IMAGEM)[number];

export function ehImagemSuportada(mediaType: string): mediaType is TipoImagem {
  return (TIPOS_IMAGEM as readonly string[]).includes(mediaType);
}

export class NotaIlegivelError extends Error {}

/**
 * O client é criado por chamada, e não no escopo do módulo, para que a
 * ausência da chave não derrube o build — só a requisição que de fato
 * precisa da IA falha.
 */
function cliente(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY não configurada");
  }
  return new Anthropic();
}

export async function extrairNota(
  conteudo: Buffer,
  mediaType: string
): Promise<NotaExtraida> {
  const base64 = conteudo.toString("base64");

  const documento: Anthropic.ContentBlockParam = ehImagemSuportada(mediaType)
    ? {
        type: "image",
        source: { type: "base64", media_type: mediaType, data: base64 },
      }
    : {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: base64,
        },
      };

  const resposta = await cliente().messages.parse({
    model: "claude-opus-5",
    max_tokens: 4096,
    system: INSTRUCOES,
    messages: [
      {
        role: "user",
        content: [
          documento,
          { type: "text", text: "Extraia os dados deste documento." },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(NotaExtraida) },
  });

  const extraido = resposta.parsed_output;

  if (!extraido) {
    throw new NotaIlegivelError(
      "Não foi possível ler a nota. Tente uma foto mais nítida."
    );
  }

  if (extraido.confianca === "baixa" && extraido.valor === null) {
    throw new NotaIlegivelError(
      "A imagem está difícil de ler. Tente de novo com mais luz e o documento reto."
    );
  }

  return {
    ...extraido,
    data_competencia: normalizarData(extraido.data_competencia),
  };
}

/** Descarta datas fora de formato ou no futuro, caindo para hoje. */
function normalizarData(data: string | null): string {
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return hoje();
  return data > hoje() ? hoje() : data;
}
