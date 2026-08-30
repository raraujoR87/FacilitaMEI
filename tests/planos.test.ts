import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assinaturaAtiva,
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

test("perfil sem a coluna do teste não é rebaixado em silêncio", () => {
  // Foi exatamente este o bug: cinco consultas esqueceram
  // `trial_expira_em`, o tipo o declarava opcional, e toda conta em teste
  // aparecia como grátis fora da barra lateral.
  const semColuna = { plano: "free", plano_expira_em: null } as never;
  const avisos: unknown[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => avisos.push(args);
  try {
    planoEfetivo(semColuna);
  } finally {
    console.error = original;
  }
  assert.equal(avisos.length, 1, "precisa avisar em desenvolvimento");
});

test("assinar durante o teste tira a conta do estado de teste", () => {
  // Era o bug: a data do teste seguia no futuro, estaEmTeste continuava
  // verdadeiro, e o assinante via "Pro por mais N dias". Da cadeira de
  // quem operava, promover a conta parecia não surtir efeito.
  const assinouNoTeste = {
    plano: "pro",
    plano_expira_em: emDias(30),
    trial_expira_em: emDias(10),
  };
  assert.equal(planoEfetivo(assinouNoTeste), "pro");
  assert.equal(assinaturaAtiva(assinouNoTeste), true);
  assert.equal(estaEmTeste(assinouNoTeste), false, "pagante não está em teste");
});

test("Pro sem prazo, como o back-office libera, também tira do teste", () => {
  const liberadoPeloAdmin = {
    plano: "pro",
    plano_expira_em: null,
    trial_expira_em: emDias(10),
  };
  assert.equal(assinaturaAtiva(liberadoPeloAdmin), true);
  assert.equal(estaEmTeste(liberadoPeloAdmin), false);
  assert.equal(planoEfetivo(liberadoPeloAdmin), "pro");
});

test("assinatura vencida devolve a conta ao teste, se ele ainda vale", () => {
  const perfil = {
    plano: "pro",
    plano_expira_em: emDias(-5),
    trial_expira_em: emDias(4),
  };
  assert.equal(assinaturaAtiva(perfil), false);
  assert.equal(estaEmTeste(perfil), true);
  assert.equal(planoEfetivo(perfil), "pro", "o teste ainda sustenta o acesso");
});

test("conta grátis pura não tem assinatura nem teste", () => {
  const perfil = { plano: "free", plano_expira_em: null, trial_expira_em: emDias(-1) };
  assert.equal(assinaturaAtiva(perfil), false);
  assert.equal(estaEmTeste(perfil), false);
  assert.equal(planoEfetivo(perfil), "free");
});

test("a contagem do teste zera para quem já assinou", () => {
  // Fecha a família de bugs por construção: qualquer tela que use a
  // contagem crua passa a ficar correta sem precisar lembrar do estaEmTeste.
  const assinante = { plano: "pro", plano_expira_em: emDias(30), trial_expira_em: emDias(9) };
  assert.equal(diasDeTesteRestantes(assinante), 0);

  const emTesteDeVerdade = { plano: "free", plano_expira_em: null, trial_expira_em: emDias(9) };
  assert.equal(diasDeTesteRestantes(emTesteDeVerdade), 9);
});
