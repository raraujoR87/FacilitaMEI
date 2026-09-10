import {
  PDFDocument,
  PDFFont,
  PDFPage,
  StandardFonts,
  rgb,
  type RGB,
} from "pdf-lib";
import { formatarData, formatarMoeda } from "./formato.ts";
import { calcularTotais, type ItemOrcamento } from "./orcamento.ts";
import { paraWinAnsi } from "./texto-pdf.ts";

/**
 * O orçamento como arquivo, para mandar no WhatsApp.
 *
 * Por que PDF de verdade e não "imprimir a tela": o app é usado no
 * celular, e imprimir-para-PDF no telefone é um caminho tortuoso que
 * ninguém completa. O que fecha negócio é o anexo pronto para encaminhar.
 *
 * `pdf-lib` em vez de um renderizador de HTML: é JS puro, roda na função
 * serverless sem navegador embutido, e as fontes padrão já cobrem os
 * acentos do português no encoding WinAnsi.
 */

const A4 = { largura: 595.28, altura: 841.89 };
const MARGEM = 42;
const LARGURA_UTIL = A4.largura - MARGEM * 2;

const TINTA = rgb(0.1, 0.1, 0.1);
const SUAVE = rgb(0.42, 0.4, 0.37);
const LINHA = rgb(0.85, 0.83, 0.78);
const PAPEL = rgb(0.97, 0.96, 0.94);

export type DadosEmpresa = {
  nome: string;
  cnpj: string | null;
  endereco: string | null;
  municipio: string | null;
  uf: string | null;
  telefone: string | null;
  email: string | null;
  assinaturaNome: string | null;
  assinaturaTitulo: string | null;
  /** Bytes do logo, já baixados. Nulo quando não há ou o plano não permite. */
  logo: { bytes: Uint8Array; tipo: "png" | "jpg" } | null;
  /** PNG da assinatura desenhada, já baixado do bucket privado. */
  assinatura: Uint8Array | null;
  corMarca: string | null;
};

export type DadosCliente = {
  nome: string | null;
  documento: string | null;
  telefone: string | null;
  email: string | null;
};

export type DadosOrcamento = {
  numero: number;
  descricao: string;
  natureza: "servico" | "produto";
  dataEmissao: string;
  validadeEm: string | null;
  desconto: number;
  itens: ItemOrcamento[];
  condicoesPagamento: string | null;
  prazoExecucao: string | null;
  garantia: string | null;
  observacoes: string | null;
  /** Link público, quando existe: vira a chamada para aceitar online. */
  linkAceite: string | null;
};

/** "#2F6E5B" → RGB do pdf-lib. Cor inválida cai no preto da tinta. */
function corDeHex(hex: string | null): RGB {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return TINTA;
  return rgb(
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255
  );
}

/**
 * Quebra o texto na largura disponível.
 *
 * Sem isso, uma observação longa sai reta para fora da página — e some,
 * porque o PDF não avisa que cortou.
 */
function quebrar(texto: string, fonte: PDFFont, tamanho: number, largura: number): string[] {
  const linhas: string[] = [];
  // Limpa ANTES de medir: `widthOfTextAtSize` também codifica o texto e
  // lança no que não cabe no WinAnsi. Sanear só na hora de desenhar
  // deixava a medição estourando primeiro.
  for (const paragrafo of paraWinAnsi(texto).split("\n")) {
    let atual = "";
    for (const palavra of paragrafo.split(/\s+/)) {
      const teste = atual ? `${atual} ${palavra}` : palavra;
      if (fonte.widthOfTextAtSize(teste, tamanho) > largura && atual) {
        linhas.push(atual);
        atual = palavra;
      } else {
        atual = teste;
      }
    }
    linhas.push(atual);
  }
  return linhas;
}

type Contexto = {
  doc: PDFDocument;
  pagina: PDFPage;
  y: number;
  regular: PDFFont;
  negrito: PDFFont;
  cor: RGB;
};

/** Abre página nova quando o conteúdo não cabe mais. */
function garantirEspaco(ctx: Contexto, altura: number): void {
  if (ctx.y - altura > MARGEM + 60) return;
  ctx.pagina = ctx.doc.addPage([A4.largura, A4.altura]);
  ctx.y = A4.altura - MARGEM;
}

function escrever(
  ctx: Contexto,
  texto: string,
  opcoes: { tamanho?: number; fonte?: PDFFont; cor?: RGB; x?: number } = {}
): void {
  const tamanho = opcoes.tamanho ?? 10;
  ctx.pagina.drawText(paraWinAnsi(texto), {
    x: opcoes.x ?? MARGEM,
    y: ctx.y,
    size: tamanho,
    font: opcoes.fonte ?? ctx.regular,
    color: opcoes.cor ?? TINTA,
  });
}

function direita(
  ctx: Contexto,
  texto: string,
  limite: number,
  opcoes: { tamanho?: number; fonte?: PDFFont; cor?: RGB } = {}
): void {
  const tamanho = opcoes.tamanho ?? 10;
  const fonte = opcoes.fonte ?? ctx.regular;
  const limpo = paraWinAnsi(texto);
  ctx.pagina.drawText(limpo, {
    x: limite - fonte.widthOfTextAtSize(limpo, tamanho),
    y: ctx.y,
    size: tamanho,
    font: fonte,
    color: opcoes.cor ?? TINTA,
  });
}

function regua(ctx: Contexto, cor: RGB = LINHA): void {
  ctx.pagina.drawLine({
    start: { x: MARGEM, y: ctx.y },
    end: { x: MARGEM + LARGURA_UTIL, y: ctx.y },
    thickness: 0.7,
    color: cor,
  });
}

function titulo(ctx: Contexto, texto: string): void {
  garantirEspaco(ctx, 40);
  ctx.y -= 22;
  escrever(ctx, texto.toUpperCase(), { tamanho: 8, fonte: ctx.negrito, cor: SUAVE });
  ctx.y -= 6;
  regua(ctx);
  ctx.y -= 14;
}

function paragrafo(ctx: Contexto, rotulo: string, texto: string | null): void {
  if (!texto) return;
  garantirEspaco(ctx, 34);
  escrever(ctx, rotulo, { tamanho: 9, fonte: ctx.negrito });
  ctx.y -= 13;
  for (const linha of quebrar(texto, ctx.regular, 9.5, LARGURA_UTIL)) {
    garantirEspaco(ctx, 14);
    escrever(ctx, linha, { tamanho: 9.5, cor: SUAVE });
    ctx.y -= 12;
  }
  ctx.y -= 6;
}

export async function gerarPdfOrcamento(
  empresa: DadosEmpresa,
  cliente: DadosCliente,
  orcamento: DadosOrcamento
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Orçamento ${orcamento.numero} — ${empresa.nome}`);
  doc.setProducer("AgilizeMei");
  doc.setCreator("AgilizeMei");

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);
  const cor = corDeHex(empresa.corMarca);

  const ctx: Contexto = {
    doc,
    pagina: doc.addPage([A4.largura, A4.altura]),
    y: A4.altura - MARGEM,
    regular,
    negrito,
    cor,
  };

  // ---------- Cabeçalho: quem propõe ----------
  let alturaLogo = 0;
  if (empresa.logo) {
    try {
      const img =
        empresa.logo.tipo === "png"
          ? await doc.embedPng(empresa.logo.bytes)
          : await doc.embedJpg(empresa.logo.bytes);
      const escala = Math.min(120 / img.width, 48 / img.height);
      alturaLogo = img.height * escala;
      ctx.pagina.drawImage(img, {
        x: MARGEM,
        y: ctx.y - alturaLogo,
        width: img.width * escala,
        height: alturaLogo,
      });
    } catch {
      // Logo corrompido ou formato inesperado não pode impedir a proposta
      // de sair: o documento vale sem ele.
      alturaLogo = 0;
    }
  }

  if (alturaLogo > 0) ctx.y -= alturaLogo + 10;

  escrever(ctx, empresa.nome, { tamanho: 16, fonte: negrito, cor });
  ctx.y -= 14;

  const identificacao = [
    empresa.cnpj ? `CNPJ ${empresa.cnpj}` : null,
    empresa.endereco,
    [empresa.municipio, empresa.uf].filter(Boolean).join("/") || null,
    empresa.telefone,
    empresa.email,
  ].filter(Boolean) as string[];

  for (const linha of identificacao) {
    escrever(ctx, linha, { tamanho: 9, cor: SUAVE });
    ctx.y -= 11;
  }

  // ---------- Faixa do documento ----------
  ctx.y -= 10;
  ctx.pagina.drawRectangle({
    x: MARGEM,
    y: ctx.y - 34,
    width: LARGURA_UTIL,
    height: 40,
    color: PAPEL,
  });
  ctx.y -= 12;
  escrever(ctx, `ORÇAMENTO Nº ${orcamento.numero}`, {
    tamanho: 13,
    fonte: negrito,
    x: MARGEM + 12,
  });
  direita(ctx, `Emitido em ${formatarData(orcamento.dataEmissao)}`, MARGEM + LARGURA_UTIL - 12, {
    tamanho: 9,
    cor: SUAVE,
  });
  ctx.y -= 14;
  escrever(
    ctx,
    orcamento.natureza === "servico" ? "Prestação de serviço" : "Fornecimento de produto",
    { tamanho: 9, cor: SUAVE, x: MARGEM + 12 }
  );
  if (orcamento.validadeEm) {
    direita(
      ctx,
      `Válido até ${formatarData(orcamento.validadeEm)}`,
      MARGEM + LARGURA_UTIL - 12,
      { tamanho: 9.5, fonte: negrito, cor }
    );
  }
  ctx.y -= 22;

  // ---------- Para quem ----------
  titulo(ctx, "Cliente");
  escrever(ctx, cliente.nome ?? "Não informado", { tamanho: 11, fonte: negrito });
  ctx.y -= 13;
  const dadosCliente = [
    cliente.documento,
    cliente.telefone,
    cliente.email,
  ].filter(Boolean) as string[];
  for (const linha of dadosCliente) {
    escrever(ctx, linha, { tamanho: 9, cor: SUAVE });
    ctx.y -= 11;
  }

  // ---------- O que está sendo orçado ----------
  titulo(ctx, "Objeto da proposta");
  for (const linha of quebrar(orcamento.descricao, regular, 10.5, LARGURA_UTIL)) {
    garantirEspaco(ctx, 14);
    escrever(ctx, linha, { tamanho: 10.5 });
    ctx.y -= 13;
  }

  // ---------- Tabela ----------
  const itens =
    orcamento.itens.length > 0
      ? orcamento.itens
      : [
          {
            descricao: orcamento.descricao,
            quantidade: 1,
            unidade: "un",
            valor_unitario: 0,
            total: 0,
          },
        ];

  const totais = calcularTotais(orcamento.itens, orcamento.desconto);

  if (orcamento.itens.length > 0) {
    titulo(ctx, "Detalhamento");

    const colQtd = MARGEM + 268;
    const colUnid = MARGEM + 318;
    const colUnit = MARGEM + 412;
    const colTotal = MARGEM + LARGURA_UTIL;

    escrever(ctx, "Descrição", { tamanho: 8, fonte: negrito, cor: SUAVE });
    direita(ctx, "Qtd", colQtd, { tamanho: 8, fonte: negrito, cor: SUAVE });
    escrever(ctx, "Un.", { tamanho: 8, fonte: negrito, cor: SUAVE, x: colUnid - 22 });
    direita(ctx, "Valor un.", colUnit, { tamanho: 8, fonte: negrito, cor: SUAVE });
    direita(ctx, "Total", colTotal, { tamanho: 8, fonte: negrito, cor: SUAVE });
    ctx.y -= 6;
    regua(ctx);
    ctx.y -= 13;

    for (const item of itens) {
      const linhas = quebrar(item.descricao, regular, 9.5, 250);
      garantirEspaco(ctx, linhas.length * 12 + 8);

      escrever(ctx, linhas[0], { tamanho: 9.5 });
      direita(ctx, formatarQuantidade(Number(item.quantidade)), colQtd, { tamanho: 9.5 });
      escrever(ctx, item.unidade, { tamanho: 9.5, cor: SUAVE, x: colUnid - 22 });
      direita(ctx, formatarMoeda(Number(item.valor_unitario)), colUnit, { tamanho: 9.5 });
      direita(ctx, formatarMoeda(Number(item.total)), colTotal, {
        tamanho: 9.5,
        fonte: negrito,
      });
      ctx.y -= 12;

      for (const extra of linhas.slice(1)) {
        escrever(ctx, extra, { tamanho: 9.5, cor: SUAVE });
        ctx.y -= 12;
      }
      ctx.y -= 3;
      regua(ctx, rgb(0.93, 0.92, 0.89));
      ctx.y -= 11;
    }
  }

  // ---------- Fechamento ----------
  garantirEspaco(ctx, 90);
  ctx.y -= 4;
  const limite = MARGEM + LARGURA_UTIL;

  if (totais.desconto > 0) {
    direita(ctx, "Subtotal", limite - 110, { tamanho: 9.5, cor: SUAVE });
    direita(ctx, formatarMoeda(totais.subtotal), limite, { tamanho: 9.5 });
    ctx.y -= 14;
    direita(
      ctx,
      totais.percentualDesconto
        ? `Desconto (${totais.percentualDesconto.toLocaleString("pt-BR")}%)`
        : "Desconto",
      limite - 110,
      { tamanho: 9.5, cor: SUAVE }
    );
    direita(ctx, `− ${formatarMoeda(totais.desconto)}`, limite, { tamanho: 9.5 });
    ctx.y -= 16;
  }

  ctx.pagina.drawRectangle({
    x: limite - 240,
    y: ctx.y - 10,
    width: 240,
    height: 30,
    color: PAPEL,
  });
  ctx.y -= 2;
  escrever(ctx, "TOTAL", { tamanho: 10, fonte: negrito, x: limite - 228 });
  direita(ctx, formatarMoeda(totais.total), limite - 12, {
    tamanho: 14,
    fonte: negrito,
    cor,
  });
  ctx.y -= 34;

  // ---------- Condições ----------
  if (
    orcamento.condicoesPagamento ||
    orcamento.prazoExecucao ||
    orcamento.garantia ||
    orcamento.observacoes
  ) {
    titulo(ctx, "Condições");
    paragrafo(ctx, "Pagamento", orcamento.condicoesPagamento);
    paragrafo(ctx, "Prazo de execução", orcamento.prazoExecucao);
    paragrafo(ctx, "Garantia", orcamento.garantia);
    paragrafo(ctx, "Observações", orcamento.observacoes);
  }

  if (orcamento.linkAceite) {
    garantirEspaco(ctx, 40);
    escrever(ctx, "Para aceitar esta proposta pelo celular:", {
      tamanho: 9,
      fonte: negrito,
    });
    ctx.y -= 12;
    for (const linha of quebrar(orcamento.linkAceite, regular, 9, LARGURA_UTIL)) {
      escrever(ctx, linha, { tamanho: 9, cor: cor });
      ctx.y -= 11;
    }
    ctx.y -= 8;
  }

  // ---------- Assinatura ----------
  garantirEspaco(ctx, 130);
  ctx.y -= 34;
  const meio = MARGEM + LARGURA_UTIL / 2;

  // O desenho fica ACIMA da linha, como numa folha assinada à mão. Sem a
  // linha embaixo, a imagem solta no branco parece um rabisco perdido.
  if (empresa.assinatura) {
    try {
      const img = await doc.embedPng(empresa.assinatura);
      const escala = Math.min(190 / img.width, 54 / img.height, 1);
      const largura = img.width * escala;
      const altura = img.height * escala;
      ctx.pagina.drawImage(img, {
        x: meio - largura / 2,
        y: ctx.y + 4,
        width: largura,
        height: altura,
      });
    } catch {
      // Assinatura corrompida não pode impedir a proposta de sair: a
      // linha e o nome continuam valendo.
    }
  }

  ctx.pagina.drawLine({
    start: { x: meio - 110, y: ctx.y },
    end: { x: meio + 110, y: ctx.y },
    thickness: 0.8,
    color: SUAVE,
  });
  ctx.y -= 13;

  const assinante = paraWinAnsi(empresa.assinaturaNome ?? empresa.nome);
  const larguraAssinante = negrito.widthOfTextAtSize(assinante, 10);
  ctx.pagina.drawText(assinante, {
    x: meio - larguraAssinante / 2,
    y: ctx.y,
    size: 10,
    font: negrito,
    color: TINTA,
  });
  ctx.y -= 12;

  if (empresa.assinaturaTitulo) {
    const titulo = paraWinAnsi(empresa.assinaturaTitulo);
    const larguraTitulo = regular.widthOfTextAtSize(titulo, 9);
    ctx.pagina.drawText(titulo, {
      x: meio - larguraTitulo / 2,
      y: ctx.y,
      size: 9,
      font: regular,
      color: SUAVE,
    });
    ctx.y -= 12;
  }

  // ---------- Rodapé em todas as páginas ----------
  const rodape = orcamento.validadeEm
    ? `Proposta válida até ${formatarData(orcamento.validadeEm)}. Após esta data os valores podem mudar.`
    : "Valores sujeitos a alteração sem aviso prévio.";

  for (const pagina of doc.getPages()) {
    pagina.drawText(paraWinAnsi(rodape), {
      x: MARGEM,
      y: MARGEM - 10,
      size: 7.5,
      font: regular,
      color: SUAVE,
    });
  }

  return doc.save();
}

/** "2" em vez de "2,00"; "1,5" quando é fracionado de verdade. */
function formatarQuantidade(valor: number): string {
  return Number.isInteger(valor)
    ? String(valor)
    : valor.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}
