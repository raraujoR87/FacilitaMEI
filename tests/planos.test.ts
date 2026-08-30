import { test } from "node:test";
import assert from "node:assert/strict";
import {
  diasDeTesteRestantes,
  estaEmTeste,
  limiteDeNotas,
  LIMITE_NOTAS_FREE,
  LIMITE_NOTAS_PRO,
  planoEfetivo,
} from "../lib/planos.ts";

const emDias = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

test("conta nova entra no Pro pelo período de teste", () => {
  const perfil = { plano: "free", plano_expira_em: null, trial_expira_em: emDias(14) };
  assert.equal(planoEfetivo(perfil), "pro");
  assert.equal(estaEmTeste(perfil), true);
});

test("teste vencido cai para o grátis", () => {
  const perfil = { plano: "free", plano_expira_em: null, trial_expira_em: emDias(-1) };
  assert.equal(planoEfetivo(perfil), "free");
  assert.equal(estaEmTeste(perfil), false);
  assert.equal(diasDeTesteRestantes(perfil), 0);
});

test("assinatura paga vale mesmo com o teste vencido", () => {
  // O caso de quem assinou durante o teste: não pode ser rebaixado quando
  // os 14 dias acabam.
  const perfil = {
    plano: "pro",
    plano_expira_em: emDias(30),
    trial_expira_em: emDias(-1),
  };
  assert.equal(planoEfetivo(perfil), "pro");
  assert.equal(estaEmTeste(perfil), false, "não é teste, é assinatura");
});

test("teste ativo sustenta o Pro mesmo sem assinatura", () => {
  const perfil = { plano: "free", plano_expira_em: emDias(-100), trial_expira_em: emDias(3) };
  assert.equal(planoEfetivo(perfil), "pro");
});

test("contagem de dias arredonda para cima", () => {
  // Meio dia restante ainda é "1 dia": dizer 0 para quem ainda tem acesso
  // seria mentira na tela.
  assert.equal(diasDeTesteRestantes({ plano: "free", plano_expira_em: null, trial_expira_em: emDias(0.5) }), 1);
  assert.equal(diasDeTesteRestantes({ plano: "free", plano_expira_em: null, trial_expira_em: null }), 0);
});

test("limite de notas acompanha o plano efetivo", () => {
  assert.equal(
    limiteDeNotas({ plano: "free", plano_expira_em: null, trial_expira_em: null }),
    LIMITE_NOTAS_FREE
  );
  assert.equal(
    limiteDeNotas({ plano: "free", plano_expira_em: null, trial_expira_em: emDias(5) }),
    LIMITE_NOTAS_PRO,
    "durante o teste vale o limite do Pro"
  );
});

test("perfil ausente é tratado como grátis", () => {
  assert.equal(planoEfetivo(null), "free");
  assert.equal(planoEfetivo(undefined), "free");
});
