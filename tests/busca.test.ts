import { test } from "node:test";
import assert from "node:assert/strict";
import { combina, combinaCadastro, normalizar } from "../lib/busca.ts";

test("acha nome acentuado digitando sem acento", () => {
  // Quem digita no celular raramente põe acento, mas o cadastro tem.
  assert.equal(normalizar("José Antônio"), "jose antonio");
  assert.equal(combina("jose", "José Antônio"), true);
  assert.equal(combina("ANTONIO", "José Antônio"), true);
});

test("termo vazio mostra tudo", () => {
  assert.equal(combina("", "qualquer coisa"), true);
  assert.equal(combina("   ", "qualquer coisa"), true);
});

test("busca em vários campos", () => {
  assert.equal(combina("coral", "Tinta branca", "Tintas Coral"), true);
  assert.equal(combina("coral", "Tinta branca", null), false);
});

test("acha CPF digitado com pontuação", () => {
  // O banco guarda só dígitos; a tela mostra formatado. Sem normalizar os
  // dois lados, procurar pelo que está na tela não acharia nada.
  assert.equal(
    combinaCadastro("11.222.333/0001-81", "Transportadora", "11222333000181", null),
    true
  );
  assert.equal(combinaCadastro("0001", "Transportadora", "11222333000181", null), true);
});

test("acha telefone com ou sem máscara", () => {
  assert.equal(combinaCadastro("(11) 98888", "Dona Lúcia", null, "11988887777"), true);
});

test("número que não bate não vira falso positivo", () => {
  assert.equal(combinaCadastro("99999", "Dona Lúcia", "11222333000181", "11988887777"), false);
});
