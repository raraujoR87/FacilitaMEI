import { test } from "node:test";
import assert from "node:assert/strict";
import { paraWinAnsi } from "../lib/texto-pdf.ts";

test("português passa inteiro", () => {
  const texto = "Serviço de instalação — João Antônio · R$ 1.234,56 (m²)";
  assert.equal(paraWinAnsi(texto), texto);
});

test("emoji não derruba a proposta", () => {
  // O caso real: cliente cadastrado com emoji no nome. Sem a limpeza, a
  // rota do PDF lança — e o MEI descobre na frente do cliente.
  assert.equal(paraWinAnsi("Pizzaria \u{1F355} do Zé"), "Pizzaria  do Zé");
});

test("emoji é par substituto e não pode ser partido ao meio", () => {
  // Varrer por índice devolveria dois caracteres inválidos em vez de zero.
  const saida = paraWinAnsi("a\u{1F468}‍\u{1F469}b");
  assert.equal(/[\uD800-\uDFFF]/.test(saida), false);
  assert.equal(saida.startsWith("a"), true);
  assert.equal(saida.endsWith("b"), true);
});

test("sinal de menos matemático vira hífen", () => {
  // U+2212 não existe no WinAnsi, e era ele na linha de desconto.
  assert.equal(paraWinAnsi("− R$ 400,00"), "- R$ 400,00");
});

test("espaço não separável do Intl vira espaço normal", () => {
  // toLocaleString em pt-BR devolve "R$" + U+00A0 + o número.
  const doIntl = (1234.5).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  assert.equal(doIntl.includes(" "), true);
  assert.equal(paraWinAnsi(doIntl), "R$ 1.234,50");
});

test("aspas e reticências coladas do Word sobrevivem", () => {
  const texto = "“aspas” e reticências…";
  assert.equal(paraWinAnsi(texto), texto);
});

test("controle é removido, quebra de linha fica", () => {
  assert.equal(paraWinAnsi("ab	c"), "abc");
  assert.equal(paraWinAnsi("linha1\nlinha2"), "linha1\nlinha2");
});

test("nulo e vazio não quebram", () => {
  assert.equal(paraWinAnsi(null), "");
  assert.equal(paraWinAnsi(undefined), "");
  assert.equal(paraWinAnsi(""), "");
});
