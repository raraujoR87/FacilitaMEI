import { test } from "node:test";
import assert from "node:assert/strict";
import {
  estaVencido,
  formatarCentavos,
  formatarData,
  formatarDataDoMomento,
  formatarMoeda,
  hoje,
  lerNumeroBR,
  intervaloDoMes,
  rotuloMes,
  ultimosMeses,
} from "../lib/formato.ts";

/** Intl usa espaço não separável entre "R$" e o número. */
const semNbsp = (s: string) => s.replace(/ /g, " ");

test("formatarData não desloca o dia por causa do fuso", () => {
  // `new Date("2026-08-01")` é meia-noite UTC, que em UTC-3 ainda é 31/07.
  // Toda data do app passa por aqui justamente para evitar isso.
  assert.equal(formatarData("2026-08-01"), "01/08/2026");
  assert.equal(formatarData("2026-01-01"), "01/01/2026");
  assert.equal(formatarData("2026-03-15T00:00:00Z"), "15/03/2026");
});

test("intervaloDoMes cobre o mês inteiro", () => {
  assert.deepEqual(intervaloDoMes("2028-02"), {
    inicio: "2028-02-01",
    fim: "2028-02-29",
  });
  assert.deepEqual(intervaloDoMes("2026-02"), {
    inicio: "2026-02-01",
    fim: "2026-02-28",
  });
  assert.deepEqual(intervaloDoMes("2026-12"), {
    inicio: "2026-12-01",
    fim: "2026-12-31",
  });
  assert.deepEqual(intervaloDoMes("2026-04"), {
    inicio: "2026-04-01",
    fim: "2026-04-30",
  });
});

test("rotuloMes escreve o mês por extenso", () => {
  assert.equal(rotuloMes("2026-08"), "agosto de 2026");
  assert.equal(rotuloMes("2026-01"), "janeiro de 2026");
});

test("ultimosMeses volta no tempo atravessando a virada de ano", () => {
  const meses = ultimosMeses(14);
  assert.equal(meses.length, 14);
  assert.equal(new Set(meses).size, 14, "não deve repetir mês");
  assert.ok(
    meses.every((m) => /^\d{4}-(0[1-9]|1[0-2])$/.test(m)),
    "todo mês deve estar em YYYY-MM"
  );
});

test("formatarMoeda usa a convenção brasileira", () => {
  assert.equal(semNbsp(formatarMoeda(1234.5)), "R$ 1.234,50");
  assert.equal(semNbsp(formatarMoeda(0)), "R$ 0,00");
  assert.equal(semNbsp(formatarMoeda(-40)), "-R$ 40,00");
});

test("formatarCentavos preenche da direita para a esquerda", () => {
  assert.equal(formatarCentavos(0), "0,00");
  assert.equal(formatarCentavos(7), "0,07");
  assert.equal(formatarCentavos(4550), "45,50");
  assert.equal(formatarCentavos(150000), "1.500,00");
});

test("estaVencido compara pela data do Brasil", () => {
  assert.equal(estaVencido(null), false);
  assert.equal(estaVencido("2020-01-01"), true);
  assert.equal(estaVencido("2099-01-01"), false);
  assert.equal(estaVencido(hoje()), false, "vence no fim do dia, não durante");
});

test("formatarDataDoMomento converte o instante para o dia no Brasil", () => {
  // 30/08 às 00:30 UTC ainda é 29/08 às 21:30 em São Paulo. Fatiar a string
  // ISO daria 30/08 e envelheceria o cadastro em um dia.
  assert.equal(formatarDataDoMomento("2026-08-30T00:30:00Z"), "29/08/2026");
  assert.equal(formatarDataDoMomento("2026-08-30T12:00:00Z"), "30/08/2026");
  // Virada de ano: 01/01 às 02:00 UTC é 31/12 no Brasil.
  assert.equal(formatarDataDoMomento("2027-01-01T02:00:00Z"), "31/12/2026");
});

test("lerNumeroBR aceita a vírgula decimal do teclado brasileiro", () => {
  // Number("7,5") é NaN. Sem este parser, um item de 7,5 h era descartado
  // pela Server Action e o recibo saía com valor menor que o combinado.
  assert.equal(lerNumeroBR("7,5"), 7.5);
  assert.equal(lerNumeroBR("7.5"), 7.5);
  assert.equal(lerNumeroBR("6"), 6);
  assert.equal(lerNumeroBR(" 2,25 "), 2.25);
  assert.equal(lerNumeroBR("abc"), 0, "texto inválido vira zero, não NaN");
  assert.equal(lerNumeroBR(""), 0);
});
