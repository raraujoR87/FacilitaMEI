import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  ehImagemSuportada,
  INSTRUCOES,
  NotaExtraida,
  PEDIDO,
  ProvedorIndisponivelError,
} from "./schema.ts";

const MODELO_PADRAO = "claude-opus-5";

export function claudeConfigurado(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function lerNotaComClaude(
  conteudo: Buffer,
  mediaType: string
): Promise<NotaExtraida> {
  if (!claudeConfigurado()) {
    throw new ProvedorIndisponivelError("claude", "ANTHROPIC_API_KEY não configurada");
  }

  // O client é criado por chamada para que a falta da chave não derrube o
  // build — só a requisição que precisa da IA falha.
  const cliente = new Anthropic();
  const base64 = conteudo.toString("base64");

  const documento: Anthropic.ContentBlockParam = ehImagemSuportada(mediaType)
    ? {
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
          data: base64,
        },
      }
    : {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: base64 },
      };

  let resposta;
  try {
    resposta = await cliente.messages.parse({
      model: process.env.CLAUDE_MODELO || MODELO_PADRAO,
      max_tokens: 4096,
      system: INSTRUCOES,
      messages: [{ role: "user", content: [documento, { type: "text", text: PEDIDO }] }],
      output_config: { format: zodOutputFormat(NotaExtraida) },
    });
  } catch (erro) {
    throw new ProvedorIndisponivelError(
      "claude",
      erro instanceof Anthropic.APIError
        ? `Claude respondeu ${erro.status}: ${erro.message}`
        : "Falha ao chamar o Claude",
      erro
    );
  }

  if (!resposta.parsed_output) {
    throw new ProvedorIndisponivelError(
      "claude",
      "Claude não devolveu a nota no formato esperado"
    );
  }

  return resposta.parsed_output;
}
