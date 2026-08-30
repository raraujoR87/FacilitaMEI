import { test } from "node:test";
import assert from "node:assert/strict";
import { diasParaDAS, situacaoTeto, tetoAplicavel, tetoDoAno } from "../lib/mei.ts";

test("teto por ano segue a progressão publicada", () => {
  assert.equal(tetoDoAno(2026), 81_000);
  assert.equal(tetoDoAno(2027), 110_000);
  assert.equal(tetoDoAno(2028), 140_000);
});

test("ano fora da tabela não devolve zero", () => {
  // Devolver 0 faria o app dizer "você estourou o teto" para todo mundo.
  assert.equal(tetoDoAno(2025), 81_000, "antes do primeiro ano tabelado");
  assert.equal(tetoDoAno(2030), 140_000, "depois do último");
});

test("limite proporcional no ano de abertura", () => {
  // Exemplo da própria Receita: abrindo em junho, 7 meses x R$ 6.750.
  assert.equal(tetoAplicavel(2026, "2026-06-15"), 47_250);
  // Julho: 6 meses.
  assert.equal(tetoAplicavel(2026, "2026-07-01"), 40_500);
  // Dezembro: 1 mês, mesmo abrindo no último dia (fração conta como mês).
  assert.equal(tetoAplicavel(2026, "2026-12-31"), 6_750);
  // Janeiro: ano cheio.
  assert.equal(tetoAplicavel(2026, "2026-01-10"), 81_000);
});

test("fora do ano de abertura o teto é cheio", () => {
  assert.equal(tetoAplicavel(2026, "2023-06-15"), 81_000);
  assert.equal(tetoAplicavel(2026, null), 81_000);
});

test("faixas acompanham o quanto foi faturado", () => {
  const faixa = (v: number) => situacaoTeto(v, 2026).faixa;
  assert.equal(faixa(10_000), "tranquilo");
  assert.equal(faixa(61_000), "atencao", "75% de 81 mil");
  assert.equal(faixa(73_000), "limite", "90%");
  assert.equal(faixa(85_000), "estourado", "acima do teto, dentro dos 20%");
  assert.equal(faixa(100_000), "grave", "acima de R$ 97.200");
});

test("a fronteira dos 20% é R$ 97.200 em 2026", () => {
  const s = situacaoTeto(0, 2026);
  assert.equal(s.limiteRetroativo, 97_200);
  assert.equal(situacaoTeto(97_200, 2026).faixa, "estourado", "no limite ainda não é retroativo");
  assert.equal(situacaoTeto(97_200.01, 2026).faixa, "grave");
});

test("percentual e restante batem com o teto proporcional", () => {
  const s = situacaoTeto(23_625, 2026, "2026-06-01"); // metade de 47.250
  assert.equal(s.teto, 47_250);
  assert.equal(s.percentual, 50);
  assert.equal(s.restante, 23_625);
});

test("contagem até o vencimento do DAS (dia 20)", () => {
  assert.equal(diasParaDAS("2026-08-01"), 19, "vence dia 20 deste mês");
  assert.equal(diasParaDAS("2026-08-20"), 0, "vence hoje");
  assert.equal(diasParaDAS("2026-08-21"), 30, "já passou: vai para setembro");
  assert.equal(diasParaDAS("2026-12-25"), 26, "vira o ano para janeiro");
});
