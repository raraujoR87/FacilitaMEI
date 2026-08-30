import { hoje } from "../formato.ts";
import { claudeConfigurado, lerNotaComClaude } from "./claude.ts";
import { geminiConfigurado, lerNotaComGemini } from "./gemini.ts";
import {
  type LeitorDeNota,
  NotaIlegivelError,
  type NotaExtraida,
  type Provedor,
  ProvedorIndisponivelError,
} from "./schema.ts";

export { NotaIlegivelError, ProvedorIndisponivelError };
export type { NotaExtraida, Provedor };

const PROVEDORES: Record<Provedor, { ler: LeitorDeNota; configurado: () => boolean }> = {
  claude: { ler: lerNotaComClaude, configurado: claudeConfigurado },
  gemini: { ler: lerNotaComGemini, configurado: geminiConfigurado },
};

/**
 * Ordem de tentativa: o provedor escolhido em `IA_PROVEDOR` primeiro, o outro
 * como reserva. Só entram os que têm chave configurada.
 */
function ordemDeTentativa(): Provedor[] {
  const preferido: Provedor =
    process.env.IA_PROVEDOR === "gemini" ? "gemini" : "claude";
  const reserva: Provedor = preferido === "claude" ? "gemini" : "claude";

  return [preferido, reserva].filter((p) => PROVEDORES[p].configurado());
}

export function provedoresDisponiveis(): Provedor[] {
  return ordemDeTentativa();
}

export type ResultadoExtracao = {
  nota: NotaExtraida;
  provedor: Provedor;
};

/**
 * Lê uma nota fiscal por visão.
 *
 * Se o provedor preferido estiver indisponível — sem chave, fora do ar, cota
 * estourada — cai no outro. Uma nota ilegível, ao contrário, interrompe na
 * hora: trocar de provedor não vai melhorar uma foto borrada.
 */
export async function extrairNota(
  conteudo: Buffer,
  mediaType: string
): Promise<ResultadoExtracao> {
  const ordem = ordemDeTentativa();

  if (ordem.length === 0) {
    throw new ProvedorIndisponivelError(
      "nenhum",
      "Nenhuma IA configurada. Defina ANTHROPIC_API_KEY ou GEMINI_API_KEY."
    );
  }

  const falhas: string[] = [];

  for (const provedor of ordem) {
    try {
      const nota = await PROVEDORES[provedor].ler(conteudo, mediaType);
      return { nota: normalizar(nota), provedor };
    } catch (erro) {
      if (erro instanceof NotaIlegivelError) throw erro;

      const motivo = erro instanceof Error ? erro.message : String(erro);
      falhas.push(`${provedor}: ${motivo}`);
      console.error(`[ocr] ${provedor} falhou —`, motivo);
    }
  }

  throw new ProvedorIndisponivelError(
    ordem.join("+"),
    `Nenhum provedor conseguiu ler a nota (${falhas.join(" | ")})`
  );
}

/** Regras que valem para qualquer provedor. */
function normalizar(nota: NotaExtraida): NotaExtraida {
  if (nota.confianca === "baixa" && nota.valor === null) {
    throw new NotaIlegivelError(
      "A imagem está difícil de ler. Tente de novo com mais luz e o documento reto."
    );
  }

  return { ...nota, data_competencia: normalizarData(nota.data_competencia) };
}

/** Descarta datas fora de formato ou no futuro, caindo para hoje. */
function normalizarData(data: string | null): string {
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return hoje();
  return data > hoje() ? hoje() : data;
}
