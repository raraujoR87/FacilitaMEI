import { test } from "node:test";
import assert from "node:assert/strict";
import { avisoDas, situacaoDoCaixa } from "../lib/caixa.ts";

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
