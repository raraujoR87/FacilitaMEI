import { test } from "node:test";
import assert from "node:assert/strict";
import { avisoDas, repartirSaidas, situacaoDoCaixa } from "../lib/caixa.ts";

test("o disponível desconta custo, retirada já feita e o imposto", () => {
  const s = situacaoDoCaixa({
    entradas: 5000,
    saidasOperacionais: 1200,
    retiradas: 800,
    valorDas: 76,
    dasPago: false,
  });
  assert.equal(s.reservaDas, 76);
  assert.equal(s.disponivel, 5000 - 1200 - 800 - 76);
});

test("DAS pago não é reservado de novo", () => {
  const s = situacaoDoCaixa({
    entradas: 1000, saidasOperacionais: 0, retiradas: 0,
    valorDas: 76, dasPago: true,
  });
  assert.equal(s.reservaDas, 0);
  assert.equal(s.disponivel, 1000);
});

test("sem valor de DAS informado não inventa reserva", () => {
  const s = situacaoDoCaixa({
    entradas: 1000, saidasOperacionais: 0, retiradas: 0,
    valorDas: null, dasPago: false,
  });
  assert.equal(s.reservaDas, 0);
  assert.equal(s.dasInformado, false, "a tela precisa saber para pedir o valor");
});

test("mês no vermelho devolve disponível negativo, não zero", () => {
  // Esconder o negativo seria mentir para quem mais precisa saber.
  const s = situacaoDoCaixa({
    entradas: 500, saidasOperacionais: 900, retiradas: 0,
    valorDas: 76, dasPago: false,
  });
  assert.equal(s.disponivel, -476);
});

test("o aviso do DAS fica urgente na reta final", () => {
  assert.equal(avisoDas("2026-08-16", false).urgente, true, "faltam 4 dias");
  assert.equal(avisoDas("2026-08-10", false).urgente, false, "faltam 10");
  assert.equal(avisoDas("2026-08-16", true).urgente, false, "já pago não urge");
});

test("pagar o DAS não muda o disponível", () => {
  // Era o bug: o imposto pago saía dos custos e a reserva zerava, então o
  // disponível SUBIA depois de o dinheiro sair da conta.
  const antesDePagar = situacaoDoCaixa({
    entradas: 3200,
    saidasOperacionais: 480,
    retiradas: 1000,
    valorDas: 76.9,
    dasPago: false,
  });

  // Pago, o DAS deixa de ser reserva e passa a compor os custos.
  const depoisDePagar = situacaoDoCaixa({
    entradas: 3200,
    saidasOperacionais: 480 + 76.9,
    retiradas: 1000,
    valorDas: 76.9,
    dasPago: true,
  });

  assert.equal(antesDePagar.disponivel, depoisDePagar.disponivel);
  assert.equal(depoisDePagar.disponivel, 1643.1);
});

test("reparte as saídas pela natureza, não pelo nome da categoria", () => {
  // A categoria é rótulo que o usuário edita. Enquanto o cálculo comparava
  // "Retirada do dono" como texto, renomear para "Pró-labore" quebrava o
  // caixa em silêncio — e o número errado é o principal da tela inicial.
  const { custos, retiradas, impostos } = repartirSaidas([
    { tipo: "receita", natureza_saida: null, valor: 5000 },
    { tipo: "despesa", natureza_saida: "custo", valor: 300 },
    { tipo: "despesa", natureza_saida: "custo", valor: 200 },
    { tipo: "despesa", natureza_saida: "retirada", valor: 1500 },
    { tipo: "despesa", natureza_saida: "imposto", valor: 76 },
  ]);

  assert.equal(custos, 500);
  assert.equal(retiradas, 1500);
  assert.equal(impostos, 76);
});

test("saída sem natureza não vira custo por acidente", () => {
  // O gatilho do banco preenche 'custo' na escrita; se um dado antigo
  // escapar, é melhor ficar de fora da conta do que inflar os custos.
  const { custos } = repartirSaidas([
    { tipo: "despesa", natureza_saida: null, valor: 999 },
  ]);
  assert.equal(custos, 0);
});
