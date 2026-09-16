import { test } from "node:test";
import assert from "node:assert/strict";
import {
  comporCusto,
  custoDosItens,
  margemDoItem,
  ordenarCatalogo,
  type ItemCatalogo,
} from "../lib/catalogo.ts";

const base: ItemCatalogo = {
  id: "x",
  nome: "Corte masculino",
  natureza: "servico",
  preco: 45,
  custo: 0,
  unidade: "un",
  arquivado_em: null,
};

test("custo dos itens arredonda por linha antes de somar", () => {
  // Igual à coluna gerada no banco: somar primeiro e arredondar depois
  // divergiria de centavo entre a tela e o documento.
  const itens = [
    { quantidade: 3, valor_unitario: 100, custo_unitario: 33.33 },
    { quantidade: 2, valor_unitario: 50, custo_unitario: 12.5 },
  ];
  assert.equal(custoDosItens(itens), 124.99);
});

test("sem custo cadastrado o total é zero, não NaN", () => {
  assert.equal(custoDosItens([{ quantidade: 2, valor_unitario: 80, custo_unitario: 0 }]), 0);
  assert.equal(custoDosItens([]), 0);
});

test("as duas origens de custo somam, mas continuam separadas", () => {
  // Catálogo sabe o custo do que foi vendido; a despesa vinculada cobre o
  // que não estava no catálogo — frete, ajudante, peça da obra.
  const c = comporCusto(
    [{ quantidade: 2, valor_unitario: 300, custo_unitario: 100 }],
    150
  );
  assert.equal(c.dosItens, 200);
  assert.equal(c.deDespesas, 150);
  assert.equal(c.total, 350);
});

test("avisa quando as duas origens têm valor", () => {
  // É o cenário de dupla contagem: cadastrou o custo no catálogo E lançou
  // a compra vinculada ao mesmo trabalho. Somar em silêncio faria a margem
  // afundar sem explicação.
  const comAmbos = comporCusto([{ quantidade: 1, valor_unitario: 100, custo_unitario: 40 }], 40);
  assert.equal(comAmbos.podeEstarDuplicado, true);

  const soItens = comporCusto([{ quantidade: 1, valor_unitario: 100, custo_unitario: 40 }], 0);
  assert.equal(soItens.podeEstarDuplicado, false);

  const soDespesa = comporCusto([{ quantidade: 1, valor_unitario: 100, custo_unitario: 0 }], 40);
  assert.equal(soDespesa.podeEstarDuplicado, false);
});

test("despesa negativa não vira crédito", () => {
  assert.equal(comporCusto([], -50).total, 0);
});

test("margem sem custo cadastrado é desconhecida, não 100%", () => {
  // "Não sei o custo" é diferente de "não teve custo".
  assert.equal(margemDoItem(base), null);
  assert.equal(margemDoItem({ ...base, custo: 15 }), 66.7);
});

test("item vendido abaixo do custo mostra margem negativa", () => {
  // Esconder o negativo tiraria justamente o aviso que importa.
  assert.equal(margemDoItem({ ...base, preco: 100, custo: 130 }), -30);
});

test("preço zerado não divide por zero", () => {
  assert.equal(margemDoItem({ ...base, preco: 0, custo: 10 }), null);
});

test("serviços vêm antes de produtos, alfabético dentro do grupo", () => {
  const ordenado = ordenarCatalogo([
    { ...base, id: "1", nome: "Zíper", natureza: "produto" },
    { ...base, id: "2", nome: "Escova", natureza: "servico" },
    { ...base, id: "3", nome: "Alicate", natureza: "produto" },
    { ...base, id: "4", nome: "Ácido", natureza: "servico" },
  ]);
  assert.deepEqual(
    ordenado.map((i) => i.nome),
    ["Ácido", "Escova", "Alicate", "Zíper"]
  );
});
