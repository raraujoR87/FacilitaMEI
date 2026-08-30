import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  adaptarSchemaParaGemini,
  validarRespostaGemini,
} from "../lib/ocr/gemini.ts";
import { NotaExtraida, ProvedorIndisponivelError } from "../lib/ocr/schema.ts";

test("o JSON Schema do Gemini perde $schema", () => {
  const { esquema } = adaptarSchemaParaGemini(
    z.toJSONSchema(NotaExtraida) as Record<string, unknown>
  );
  assert.equal(
    "$schema" in esquema,
    false,
    "$schema não está no subconjunto aceito pelo Gemini"
  );
});

test("campos anuláveis viram opcionais de tipo simples", () => {
  const { esquema, camposAnulaveis } = adaptarSchemaParaGemini(
    z.toJSONSchema(NotaExtraida) as Record<string, unknown>
  );

  // O Zod emite `["string","null"]`, que o Gemini não interpreta.
  assert.deepEqual(camposAnulaveis.sort(), [
    "data_competencia",
    "fornecedor_cliente",
    "valor",
  ]);

  assert.equal(esquema.properties!.valor.type, "number");
  assert.equal(esquema.properties!.data_competencia.type, "string");

  for (const campo of camposAnulaveis) {
    assert.ok(
      !esquema.required!.includes(campo),
      `${campo} não pode ser obrigatório se o modelo pode omiti-lo`
    );
  }
});

test("campos não anuláveis seguem obrigatórios e com enum preservado", () => {
  const { esquema } = adaptarSchemaParaGemini(
    z.toJSONSchema(NotaExtraida) as Record<string, unknown>
  );

  assert.ok(esquema.required!.includes("descricao"));
  assert.ok(esquema.required!.includes("tipo"));
  assert.ok(esquema.required!.includes("confianca"));
  assert.deepEqual(esquema.properties!.tipo.enum, ["receita", "despesa"]);
  assert.deepEqual(esquema.properties!.confianca.enum, ["alta", "media", "baixa"]);
});

const RESPOSTA_COMPLETA = JSON.stringify({
  descricao: "Tinta acrílica 18L",
  valor: 289.9,
  data_competencia: "2026-08-20",
  fornecedor_cliente: "Casa das Tintas",
  tipo: "despesa",
  categoria_sugerida: "Material de trabalho",
  confianca: "alta",
});

test("resposta completa do Gemini é aceita", () => {
  const nota = validarRespostaGemini(RESPOSTA_COMPLETA);
  assert.equal(nota.valor, 289.9);
  assert.equal(nota.tipo, "despesa");
  assert.equal(nota.fornecedor_cliente, "Casa das Tintas");
});

test("campo omitido pelo Gemini vira null, não erro", () => {
  // É esse o contrato: o modelo omite o que não conseguiu ler.
  const nota = validarRespostaGemini(
    JSON.stringify({
      descricao: "Cupom rasgado",
      tipo: "despesa",
      categoria_sugerida: "Outros",
      confianca: "baixa",
    })
  );

  assert.equal(nota.valor, null);
  assert.equal(nota.data_competencia, null);
  assert.equal(nota.fornecedor_cliente, null);
});

test("cerca de markdown é removida antes do parse", () => {
  const nota = validarRespostaGemini("```json\n" + RESPOSTA_COMPLETA + "\n```");
  assert.equal(nota.descricao, "Tinta acrílica 18L");
});

test("JSON inválido vira erro de provedor, não exceção crua", () => {
  assert.throws(
    () => validarRespostaGemini("isso não é json"),
    (erro: unknown) =>
      erro instanceof ProvedorIndisponivelError && erro.provedor === "gemini"
  );
});

test("valor fora do enum é recusado", () => {
  assert.throws(
    () =>
      validarRespostaGemini(
        JSON.stringify({
          descricao: "x",
          tipo: "entrada",
          categoria_sugerida: "Outros",
          confianca: "alta",
        })
      ),
    ProvedorIndisponivelError
  );
});

test("tipo errado no valor é recusado em vez de virar NaN", () => {
  assert.throws(
    () =>
      validarRespostaGemini(
        JSON.stringify({
          descricao: "x",
          valor: "289,90",
          tipo: "despesa",
          categoria_sugerida: "Outros",
          confianca: "alta",
        })
      ),
    ProvedorIndisponivelError
  );
});

// --- escolha de provedor -------------------------------------------------

const { provedoresDisponiveis } = await import("../lib/ocr/index.ts");

/** Roda o corpo com um conjunto controlado de variáveis de ambiente. */
function comAmbiente(vars: Record<string, string | undefined>, corpo: () => void) {
  const anterior: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    anterior[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    corpo();
  } finally {
    for (const [k, v] of Object.entries(anterior)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

const SEM_CHAVES = {
  ANTHROPIC_API_KEY: undefined,
  GEMINI_API_KEY: undefined,
  GOOGLE_API_KEY: undefined,
  IA_PROVEDOR: undefined,
};

test("sem nenhuma chave, nenhum provedor fica disponível", () => {
  comAmbiente(SEM_CHAVES, () => {
    assert.deepEqual(provedoresDisponiveis(), []);
  });
});

test("com só uma chave, só aquele provedor entra", () => {
  comAmbiente({ ...SEM_CHAVES, GEMINI_API_KEY: "x" }, () => {
    assert.deepEqual(provedoresDisponiveis(), ["gemini"]);
  });
  comAmbiente({ ...SEM_CHAVES, ANTHROPIC_API_KEY: "x" }, () => {
    assert.deepEqual(provedoresDisponiveis(), ["claude"]);
  });
});

test("IA_PROVEDOR decide a ordem, o outro vira reserva", () => {
  const ambas = { ...SEM_CHAVES, ANTHROPIC_API_KEY: "x", GEMINI_API_KEY: "y" };

  comAmbiente({ ...ambas, IA_PROVEDOR: "gemini" }, () => {
    assert.deepEqual(provedoresDisponiveis(), ["gemini", "claude"]);
  });
  comAmbiente({ ...ambas, IA_PROVEDOR: "claude" }, () => {
    assert.deepEqual(provedoresDisponiveis(), ["claude", "gemini"]);
  });
});

test("claude é o padrão quando IA_PROVEDOR não é reconhecido", () => {
  comAmbiente(
    { ...SEM_CHAVES, ANTHROPIC_API_KEY: "x", GEMINI_API_KEY: "y", IA_PROVEDOR: "bobagem" },
    () => {
      assert.deepEqual(provedoresDisponiveis(), ["claude", "gemini"]);
    }
  );
});

test("GOOGLE_API_KEY também habilita o Gemini", () => {
  // É a variável que o próprio SDK do Google lê por convenção.
  comAmbiente({ ...SEM_CHAVES, GOOGLE_API_KEY: "x" }, () => {
    assert.deepEqual(provedoresDisponiveis(), ["gemini"]);
  });
});
