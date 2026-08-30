import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularMargem, faixaDaMargem } from "../lib/margem.ts";

test("margem saudável", () => {
  const m = calcularMargem(1000, 300);
  assert.equal(m.lucro, 700);
  assert.equal(m.percentual, 70);
  assert.equal(faixaDaMargem(m), "boa");
});

test("margem apertada abaixo de 30%", () => {
  const m = calcularMargem(1000, 780);
  assert.equal(m.percentual, 22);
  assert.equal(faixaDaMargem(m), "apertada");
});

test("custo maior que a receita é prejuízo, não zero", () => {
  // Esconder o negativo tiraria justamente o aviso que importa.
  const m = calcularMargem(500, 800);
  assert.equal(m.lucro, -300);
  assert.equal(m.percentual, -60);
  assert.equal(faixaDaMargem(m), "prejuizo");
});

test("sem custo lançado a margem é desconhecida, não 100%", () => {
  // "Não sei o custo" é diferente de "não teve custo". Mostrar 100%
  // daria uma certeza que o dado não tem.
  const m = calcularMargem(1000, 0);
  assert.equal(m.semCustoAtribuido, true);
  assert.equal(faixaDaMargem(m), "desconhecida");
});

test("receita zero não divide por zero", () => {
  const m = calcularMargem(0, 150);
  assert.equal(m.percentual, null);
  assert.equal(m.lucro, -150);
});
