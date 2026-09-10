import { test } from "node:test";
import assert from "node:assert/strict";
import { cabeNoPdf, detectarFormato } from "../lib/imagem-formato.ts";

const bytes = (...valores: number[]) => new Uint8Array([...valores, ...Array(12).fill(0)]);

test("reconhece PNG pelos bytes, não pelo content-type", () => {
  assert.equal(detectarFormato(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)), "png");
});

test("reconhece JPEG", () => {
  assert.equal(detectarFormato(bytes(0xff, 0xd8, 0xff, 0xe0)), "jpg");
});

test("reconhece WEBP — o formato que sumiu com o logo", () => {
  // RIFF + 4 bytes de tamanho + WEBP. Era exatamente este arquivo que o
  // código tratava como JPEG e o pdf-lib recusava em silêncio.
  const webp = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x38, 0x1f, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  ]);
  assert.equal(detectarFormato(webp), "webp");
  assert.equal(cabeNoPdf("webp"), false);
});

test("reconhece GIF", () => {
  assert.equal(detectarFormato(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61)), "gif");
});

test("reconhece SVG, com e sem declaração XML", () => {
  const comXml = new TextEncoder().encode('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>');
  const semXml = new TextEncoder().encode('<svg viewBox="0 0 10 10"></svg>');
  assert.equal(detectarFormato(comXml), "svg");
  assert.equal(detectarFormato(semXml), "svg");
  assert.equal(cabeNoPdf("svg"), false);
});

test("arquivo curto ou lixo não vira formato por acidente", () => {
  assert.equal(detectarFormato(new Uint8Array([0x89, 0x50])), null);
  assert.equal(detectarFormato(new TextEncoder().encode("isto nao e imagem nenhuma")), null);
});

test("só PNG e JPG cabem no PDF", () => {
  assert.equal(cabeNoPdf("png"), true);
  assert.equal(cabeNoPdf("jpg"), true);
  assert.equal(cabeNoPdf(null), false);
});
