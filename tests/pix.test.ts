import { test } from "node:test";
import assert from "node:assert/strict";
import { gerarBrCode, normalizarChavePix } from "../lib/pix.ts";

/** Percorre o payload EMV validando o tamanho declarado de cada campo. */
function parseTlv(payload: string): Record<string, string> {
  const campos: Record<string, string> = {};
  let i = 0;
  while (i < payload.length) {
    const id = payload.slice(i, i + 2);
    const tamanho = Number(payload.slice(i + 2, i + 4));
    assert.match(id, /^\d{2}$/, `id inválido na posição ${i}`);
    assert.ok(!Number.isNaN(tamanho), `tamanho inválido na posição ${i}`);
    const valor = payload.slice(i + 4, i + 4 + tamanho);
    assert.equal(valor.length, tamanho, `campo ${id} com tamanho inconsistente`);
    campos[id] = valor;
    i += 4 + tamanho;
  }
  assert.equal(i, payload.length, "sobrou conteúdo após o último campo");
  return campos;
}

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

const BASE = {
  chave: "raphael@exemplo.com.br",
  tipoChave: "email" as const,
  nomeTitular: "José da Silva Ação",
  cidade: "São Paulo",
};

test("crc16 bate com o valor de referência do CRC-16/CCITT-FALSE", () => {
  // Valor canônico de checagem do algoritmo, independente do PIX.
  assert.equal(crc16("123456789"), "29B1");
});

test("o CRC declarado no fim confere com o payload", () => {
  const brcode = gerarBrCode({ ...BASE, valor: 45.5 });
  assert.equal(crc16(brcode.slice(0, -4)), brcode.slice(-4));
});

test("o payload é um TLV bem formado com os campos obrigatórios", () => {
  const campos = parseTlv(gerarBrCode({ ...BASE, valor: 45.5, identificador: "FMEI7" }));

  assert.equal(campos["00"], "01", "indicador de formato");
  assert.equal(campos["53"], "986", "moeda BRL");
  assert.equal(campos["54"], "45.50", "valor com ponto decimal");
  assert.equal(campos["58"], "BR", "país");

  const conta = parseTlv(campos["26"]);
  assert.equal(conta["00"], "br.gov.bcb.pix");
  assert.equal(conta["01"], "raphael@exemplo.com.br");
  assert.equal(parseTlv(campos["62"])["05"], "FMEI7");
});

test("acentos são removidos e os campos respeitam o limite do padrão", () => {
  const campos = parseTlv(
    gerarBrCode({
      chave: "11122233344",
      tipoChave: "cpf",
      nomeTitular: "Estabelecimento Com Nome Absurdamente Longo Ltda",
      cidade: "São José dos Campos dos Pinhais",
    })
  );

  assert.equal(campos["59"].length, 25, "nome do titular vai até 25");
  assert.equal(campos["60"].length, 15, "cidade vai até 15");
  assert.match(campos["59"], /^[A-Z0-9 ]+$/, "sem acento e em maiúsculas");
  assert.match(campos["60"], /^[A-Z0-9 ]+$/);
});

test("valor ausente omite o campo em vez de zerar", () => {
  const campos = parseTlv(gerarBrCode(BASE));
  assert.equal(campos["54"], undefined);
});

test("o payload inteiro é ASCII imprimível", () => {
  const brcode = gerarBrCode({ ...BASE, valor: 1234.56 });
  assert.match(brcode, /^[\x20-\x7E]+$/);
});

test("cada tipo de chave é normalizado como o banco espera", () => {
  assert.equal(normalizarChavePix("111.222.333-44", "cpf"), "11122233344");
  assert.equal(normalizarChavePix("12.345.678/0001-90", "cnpj"), "12345678000190");
  assert.equal(normalizarChavePix("(11) 98888-7777", "telefone"), "+5511988887777");
  assert.equal(normalizarChavePix("+55 11 98888-7777", "telefone"), "+5511988887777");
  assert.equal(normalizarChavePix("  Raphael@Exemplo.COM ", "email"), "raphael@exemplo.com");
});

test("valores com centavos quebrados não perdem precisão no payload", () => {
  const campos = parseTlv(gerarBrCode({ ...BASE, valor: 1234.56 }));
  assert.equal(campos["54"], "1234.56");
});
