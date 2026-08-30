import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cnpjValido,
  cpfValido,
  diasParaEmissorNacional,
  documentoValido,
  formatarDocumento,
  situacaoFiscal,
  tipoPessoa,
} from "../lib/fiscal.ts";

test("CPF válido é aceito e adulterado é recusado", () => {
  assert.equal(cpfValido("111.444.777-35"), true);
  assert.equal(cpfValido("529.982.247-25"), true);
  assert.equal(cpfValido("11144477735"), true, "aceita sem pontuação");

  assert.equal(cpfValido("111.444.777-36"), false, "dígito verificador trocado");
  assert.equal(cpfValido("111.111.111-11"), false, "sequência repetida");
  assert.equal(cpfValido("1114447773"), false, "curto demais");
});

test("CNPJ válido é aceito e adulterado é recusado", () => {
  assert.equal(cnpjValido("11.222.333/0001-81"), true);
  assert.equal(cnpjValido("11222333000181"), true);

  assert.equal(cnpjValido("11.222.333/0001-82"), false);
  assert.equal(cnpjValido("11.111.111/1111-11"), false);
  assert.equal(cnpjValido("1122233300018"), false);
});

test("documentoValido escolhe a regra pelo tamanho", () => {
  assert.equal(documentoValido("11144477735"), true);
  assert.equal(documentoValido("11222333000181"), true);
  assert.equal(documentoValido("123"), false);
});

test("tipoPessoa distingue física, jurídica e ausência", () => {
  assert.equal(tipoPessoa("11144477735"), "fisica");
  assert.equal(tipoPessoa("11222333000181"), "juridica");
  assert.equal(tipoPessoa(null), "sem_documento");
  assert.equal(tipoPessoa(""), "sem_documento");
});

test("formatarDocumento aplica a máscara certa para cada tamanho", () => {
  assert.equal(formatarDocumento("11144477735"), "111.444.777-35");
  assert.equal(formatarDocumento("11222333000181"), "11.222.333/0001-81");
});

test("serviço para empresa obriga NFS-e", () => {
  const s = situacaoFiscal("servico", "11222333000181");
  assert.equal(s.obrigatoria, true);
  assert.equal(s.documento, "NFS-e");
});

test("produto para empresa obriga NF-e", () => {
  const s = situacaoFiscal("produto", "11222333000181");
  assert.equal(s.obrigatoria, true);
  assert.equal(s.documento, "NF-e");
});

test("venda para pessoa física não obriga nota", () => {
  // Dispensa prevista na Resolução CGSN 140/2018.
  for (const natureza of ["servico", "produto"] as const) {
    const s = situacaoFiscal(natureza, "11144477735");
    assert.equal(s.obrigatoria, false);
  }
});

test("sem documento o app admite que não sabe, em vez de liberar", () => {
  const s = situacaoFiscal("servico", null);
  assert.equal(s.obrigatoria, false);
  assert.equal(s.documento, null);
  assert.match(s.resumo, /CPF ou CNPJ/);
});

test("contagem até o Emissor Nacional (01/11/2026)", () => {
  assert.equal(diasParaEmissorNacional("2026-11-01"), 0);
  assert.equal(diasParaEmissorNacional("2026-10-31"), 1);
  assert.equal(diasParaEmissorNacional("2026-11-02"), -1, "negativo depois do prazo");
});
