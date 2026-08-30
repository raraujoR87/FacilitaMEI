import { test } from "node:test";
import assert from "node:assert/strict";
import {
  descreverVencimento,
  resumirFixas,
  venceuNoMes,
  type ContaFixa,
} from "../lib/recorrentes.ts";

const base: ContaFixa = {
  id: "x", descricao: "Internet", valor: 120, dia_vencimento: 10,
  categoria_id: null, categoria: null,
  lancamento_id: null, valor_lancado: null, lancado_em: null,
};

test("separa o que falta lançar do que já entrou", () => {
  const resumo = resumirFixas([
    { ...base, id: "a", valor: 120 },
    { ...base, id: "b", valor: 800, lancamento_id: "l1", valor_lancado: 800 },
  ]);
  assert.equal(resumo.pendentes.length, 1);
  assert.equal(resumo.aLancar, 120);
  assert.equal(resumo.lancado, 800);
});

test("o total lançado usa o valor real, não o previsto", () => {
  // Conta de luz prevista em 200 que veio 340: somar o previsto mostraria
  // um total que não bate com o extrato do banco.
  const resumo = resumirFixas([
    { ...base, valor: 200, lancamento_id: "l1", valor_lancado: 340 },
  ]);
  assert.equal(resumo.lancado, 340);
});

test("conta já lançada não aparece como atrasada", () => {
  const paga = { ...base, lancamento_id: "l1", valor_lancado: 120 };
  assert.equal(venceuNoMes(paga, "2026-08", "2026-08-29"), false);
});

test("atraso só vale para o mês corrente", () => {
  // Abrir agosto em dezembro e ver tudo "atrasado" seria alarme falso
  // sobre algo que não dá mais para resolver.
  assert.equal(venceuNoMes(base, "2026-08", "2026-12-01"), false);
  assert.equal(venceuNoMes(base, "2026-08", "2026-08-29"), true);
  assert.equal(venceuNoMes(base, "2026-08", "2026-08-09"), false);
});

test("conta sem dia fixo nunca está atrasada", () => {
  const semDia = { ...base, dia_vencimento: null };
  assert.equal(venceuNoMes(semDia, "2026-08", "2026-08-29"), false);
  assert.equal(descreverVencimento(semDia), "sem dia fixo");
});
