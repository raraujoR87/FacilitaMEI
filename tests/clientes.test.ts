import { test } from "node:test";
import assert from "node:assert/strict";
import {
  descreverRecorrencia,
  rankingTemInversao,
  situacaoDoCliente,
  type MetricaCliente,
} from "../lib/clientes.ts";

const base: MetricaCliente = {
  cliente_id: "x", nome: "Fulano", documento: null, telefone: null,
  email: null, observacoes: null, arquivado_em: null,
  documentos: 0, total_pago: 0, total_aberto: 0, total_vencido: 0,
  ticket_medio: 0, primeira_compra: null, ultima_compra: null,
  dias_desde_ultima: null, intervalo_medio_dias: null, pagou_com_atraso: 0,
  custo_atribuido: 0, lucro: 0,
};

test("quem deve vem antes de tudo", () => {
  // Dinheiro parado é mais urgente que oportunidade de venda.
  const devedorSumido = { ...base, documentos: 5, total_vencido: 300, dias_desde_ultima: 200 };
  assert.equal(situacaoDoCliente(devedorSumido), "devendo");
});

test("sumido exige ter comprado mais de uma vez", () => {
  // Quem comprou uma vez e não voltou pode nunca ter sido cliente de
  // verdade; tratar como perda gera cobrança fora de hora.
  const umaCompraSo = { ...base, documentos: 1, dias_desde_ultima: 120 };
  assert.equal(situacaoDoCliente(umaCompraSo), "inativo");

  const habitual = { ...base, documentos: 6, dias_desde_ultima: 120 };
  assert.equal(situacaoDoCliente(habitual), "sumido");
});

test("comprou há pouco e volta sempre é recorrente", () => {
  assert.equal(
    situacaoDoCliente({ ...base, documentos: 4, dias_desde_ultima: 12 }),
    "recorrente"
  );
});

test("cadastrado sem compra é novo, não sumido", () => {
  assert.equal(situacaoDoCliente(base), "novo");
});

test("a recorrência é dita na unidade que se entende", () => {
  const com = (dias: number, docs = 4) =>
    descreverRecorrencia({ ...base, documentos: docs, intervalo_medio_dias: dias });

  assert.equal(com(7), "volta a cada 7 dias");
  assert.equal(com(21), "volta a cada 3 semanas");
  assert.equal(com(90), "volta a cada 3 meses");
  assert.equal(descreverRecorrencia({ ...base, documentos: 1 }), "primeira compra");
});

test("sem custo lançado não existe inversão de ranking", () => {
  // Sem custo, o ranking de lucro é cópia do de faturamento — anunciar
  // "quem mais fatura não é quem mais lucra" seria mentira.
  const a = { ...base, cliente_id: "a", total_pago: 5000, lucro: 5000 };
  const b = { ...base, cliente_id: "b", total_pago: 1000, lucro: 1000 };
  assert.equal(rankingTemInversao([a, b]), false);
});

test("detecta o cliente grande que rende menos", () => {
  // Faturou 5.000 mas consumiu 4.600 de material; o pequeno sobra mais.
  const grande = {
    ...base, cliente_id: "a", nome: "Obra grande",
    total_pago: 5000, custo_atribuido: 4600, lucro: 400,
  };
  const pequeno = {
    ...base, cliente_id: "b", nome: "Manutenção",
    total_pago: 1000, custo_atribuido: 100, lucro: 900,
  };
  assert.equal(rankingTemInversao([grande, pequeno]), true);
});

test("mesmo campeão nos dois rankings não é inversão", () => {
  const a = { ...base, cliente_id: "a", total_pago: 5000, custo_atribuido: 500, lucro: 4500 };
  const b = { ...base, cliente_id: "b", total_pago: 1000, custo_atribuido: 100, lucro: 900 };
  assert.equal(rankingTemInversao([a, b]), false);
});
