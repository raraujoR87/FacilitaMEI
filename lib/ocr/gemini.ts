import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import {
  INSTRUCOES,
  NotaExtraida,
  PEDIDO,
  ProvedorIndisponivelError,
} from "./schema.ts";

const MODELO_PADRAO = "gemini-2.5-flash";

export function geminiConfigurado(): boolean {
  return Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
}

type PropriedadeJson = { type?: unknown; [chave: string]: unknown };
type EsquemaJson = {
  properties?: Record<string, PropriedadeJson>;
  required?: string[];
  [chave: string]: unknown;
};

/**
 * Adapta o JSON Schema do Zod ao subconjunto que o Gemini aceita.
 *
 * Duas incompatibilidades: `$schema` não está na lista de chaves suportadas,
 * e campos anuláveis saem do Zod como tipo-união (`["string","null"]`), que o
 * Gemini não interpreta. A união vira campo opcional de tipo simples — o
 * modelo omite o campo em vez de mandar null, e `null` é recolocado depois.
 *
 * Exportada para poder ser testada sem chamar a API.
 */
export function adaptarSchemaParaGemini(esquema: EsquemaJson): {
  esquema: EsquemaJson;
  camposAnulaveis: string[];
} {
  // `$schema` fica de fora: não está entre as chaves que o Gemini aceita.
  const resto: EsquemaJson = { ...esquema };
  delete resto.$schema;
  const propriedades: Record<string, PropriedadeJson> = {};
  const camposAnulaveis: string[] = [];

  for (const [nome, definicao] of Object.entries(resto.properties ?? {})) {
    if (Array.isArray(definicao.type) && definicao.type.includes("null")) {
      const tipoReal = definicao.type.filter((t) => t !== "null");
      propriedades[nome] = {
        ...definicao,
        type: tipoReal.length === 1 ? tipoReal[0] : tipoReal,
      };
      camposAnulaveis.push(nome);
    } else {
      propriedades[nome] = definicao;
    }
  }

  return {
    esquema: {
      ...resto,
      properties: propriedades,
      required: (resto.required ?? []).filter((c) => !camposAnulaveis.includes(c)),
    },
    camposAnulaveis,
  };
}

const { esquema: ESQUEMA_GEMINI, camposAnulaveis: CAMPOS_ANULAVEIS } =
  adaptarSchemaParaGemini(z.toJSONSchema(NotaExtraida) as EsquemaJson);

export async function lerNotaComGemini(
  conteudo: Buffer,
  mediaType: string
): Promise<NotaExtraida> {
  const chave = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!chave) {
    throw new ProvedorIndisponivelError("gemini", "GEMINI_API_KEY não configurada");
  }

  const ia = new GoogleGenAI({ apiKey: chave });

  let texto: string | undefined;
  try {
    const resposta = await ia.models.generateContent({
      model: process.env.GEMINI_MODELO || MODELO_PADRAO,
      contents: [
        {
          role: "user",
          parts: [
            // O Gemini aceita imagem e PDF pelo mesmo campo inline.
            { inlineData: { mimeType: mediaType, data: conteudo.toString("base64") } },
            { text: PEDIDO },
          ],
        },
      ],
      config: {
        systemInstruction: INSTRUCOES,
        responseMimeType: "application/json",
        responseJsonSchema: ESQUEMA_GEMINI,
      },
    });
    texto = resposta.text;
  } catch (erro) {
    throw new ProvedorIndisponivelError(
      "gemini",
      erro instanceof Error ? `Falha ao chamar o Gemini: ${erro.message}` : "Falha ao chamar o Gemini",
      erro
    );
  }

  if (!texto) {
    throw new ProvedorIndisponivelError("gemini", "Gemini devolveu resposta vazia");
  }

  return validarRespostaGemini(texto);
}

/** Exportada para teste: converte o texto cru do Gemini na nota validada. */
export function validarRespostaGemini(texto: string): NotaExtraida {
  let bruto: unknown;
  try {
    // Com responseMimeType JSON não deveria vir cerca de markdown, mas
    // tirá-la é barato e evita uma falha boba.
    bruto = JSON.parse(texto.replace(/^```(?:json)?|```$/g, "").trim());
  } catch {
    throw new ProvedorIndisponivelError("gemini", "Gemini devolveu um JSON inválido");
  }

  // Os campos anuláveis foram declarados opcionais para o Gemini; ausência
  // significa "não consegui ler", que no contrato é null.
  const objeto = bruto as Record<string, unknown>;
  for (const campo of CAMPOS_ANULAVEIS) {
    if (objeto[campo] === undefined) objeto[campo] = null;
  }

  const resultado = NotaExtraida.safeParse(objeto);
  if (!resultado.success) {
    throw new ProvedorIndisponivelError(
      "gemini",
      `Gemini devolveu a nota fora do formato: ${resultado.error.issues
        .map((i) => i.path.join("."))
        .join(", ")}`
    );
  }

  return resultado.data;
}
