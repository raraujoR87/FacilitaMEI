import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcularTotais,
  diasDeValidade,
  situacaoDoOrcamento,
  validadeSugerida,
  venceu,
  type Orcamento,
} from "../lib/orcamento.ts";

const base: Orcamento = {
  id: "x", numero: 1, descricao_servico: "Pintura", valor: 1000, desconto: 0,
  status: "pendente", data_emissao: "2026-09-01", validade_em: "2026-09-16",
  aceito_em: null, aceito_por: null, token_publico: "tok",
};

test("validade compara texto, sem fuso", () => {
  // `new Date("2026-09-16")` é meia-noite UTC — em Brasília ainda é dia 15,
  // e o orçamento venceria um dia antes do combinado.
  assert.equal(venceu("2026-09-16", "2026-09-16"), false);
  assert.equal(venceu("2026-09-16", "2026-09-17"), true);
  assert.equal(venceu(null, "2026-12-31"), false);
});

test("vencido é calculado, não guardado", () => {
  assert.equal(situacaoDoOrcamento(base, "2026-09-10"), "aguardando");
  assert.equal(situacaoDoOrcamento(base, "2026-09-20"), "vencido");
});

test("aceite vence a validade", () => {
  // Aceito no prazo continua aceito depois — o cliente cumpriu a parte dele.
  const aceito = { ...base, aceito_em: "2026-09-10T12:00:00Z", aceito_por: "Maria" };
  assert.equal(situacaoDoOrcamento(aceito, "2026-09-30"), "aceito");
});

test("sem link é rascunho, não aguardando resposta", () => {
  // Ninguém está esperando: o cliente nunca recebeu.
  assert.equal(situacaoDoOrcamento({ ...base, token_publico: null }, "2026-09-10"), "rascunho");
});

test("convertido e cancelado saem do fluxo", () => {
  assert.equal(situacaoDoOrcamento({ ...base, status: "convertido" }, "2026-09-30"), "convertido");
  assert.equal(situacaoDoOrcamento({ ...base, status: "cancelado" }, "2026-09-30"), "recusado");
});

test("desconto abate do subtotal", () => {
  const itens = [
    { descricao: "Tinta", quantidade: 4, unidade: "lata", valor_unitario: 150, total: 600 },
    { descricao: "Mão de obra", quantidade: 1, unidade: "un", valor_unitario: 900, total: 900 },
  ];
  const t = calcularTotais(itens, 150);
  assert.equal(t.subtotal, 1500);
  assert.equal(t.total, 1350);
  assert.equal(t.percentualDesconto, 10);
});

test("desconto maior que o subtotal não vira total negativo", () => {
  // Erro de digitação não pode fazer a proposta cobrar valor negativo.
  const t = calcularTotais([{ descricao: "a", quantidade: 1, unidade: "un", valor_unitario: 100, total: 100 }], 500);
  assert.equal(t.total, 0);
  assert.equal(t.desconto, 100);
});

test("dias de validade contam do jeito humano", () => {
  assert.equal(diasDeValidade("2026-09-16", "2026-09-10"), 6);
  assert.equal(diasDeValidade("2026-09-16", "2026-09-16"), 0);
  assert.equal(diasDeValidade("2026-09-16", "2026-09-20"), -4);
});

test("validade sugerida cruza o mês sem erro", () => {
  assert.equal(validadeSugerida("2026-09-01"), "2026-09-16");
  assert.equal(validadeSugerida("2026-08-25"), "2026-09-09");
  assert.equal(validadeSugerida("2026-12-28"), "2027-01-12");
});
