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
 *
 * A diagramação trabalha em blocos delimitados — cada informação no seu
 * quadro — porque é o que separa proposta de lista solta. A identidade
 * vem da cor da marca repetida nos marcadores de seção e na faixa do
 * total, não de uma fonte própria: fonte embutida pesaria na função
 * serverless para ganho que o cliente não nota.
 */

const A4 = { largura: 595.28, altura: 841.89 };
const MARGEM = 42;
const LARGURA_UTIL = A4.largura - MARGEM * 2;
/** Espaço reservado no pé para o rodapé não encostar no conteúdo. */
const PE = MARGEM + 34;

const TINTA = rgb(0.1, 0.1, 0.1);
const SUAVE = rgb(0.35, 0.33, 0.31);
const BORDA = rgb(0.85, 0.83, 0.78);
const PAPEL = rgb(0.969, 0.961, 0.941);
const BRANCO = rgb(1, 1, 1);

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
  descontoPercentual: number | null;
  /** Total já gravado. É a única referência quando não há itens. */
  valorTotal: number;
  itens: ItemOrcamento[];
  condicoesPagamento: string | null;
  prazoExecucao: string | null;
  garantia: string | null;
  observacoes: string | null;
  /** Link público, quando existe: vira a chamada para aceitar online. */
  linkAceite: string | null;
};

/** "#2F6E5B" → RGB do pdf-lib. Cor inválida cai no verde da casa. */
function corDeHex(hex: string | null): RGB {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return rgb(0.184, 0.431, 0.357);
  return rgb(
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255
  );
}

/**
 * Versão clara da cor, para fundo de faixa.
 *
 * A cor da marca é escolhida pelo usuário e pode ser qualquer uma; usá-la
 * cheia atrás de texto pequeno deixaria o documento ilegível em metade
 * dos casos.
 */
function clarear(cor: RGB, quanto: number): RGB {
  return rgb(
    cor.red + (1 - cor.red) * quanto,
    cor.green + (1 - cor.green) * quanto,
    cor.blue + (1 - cor.blue) * quanto
  );
}

/** Texto claro sobre fundo escuro, escuro sobre claro. */
function contrasteSobre(fundo: RGB): RGB {
  const luz = 0.299 * fundo.red + 0.587 * fundo.green + 0.114 * fundo.blue;
  return luz > 0.6 ? TINTA : BRANCO;
}

function quebrar(
  texto: string,
  fonte: PDFFont,
  tamanho: number,
  largura: number
): string[] {
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

function novaPagina(ctx: Contexto): void {
  ctx.pagina = ctx.doc.addPage([A4.largura, A4.altura]);
  ctx.y = A4.altura - MARGEM;
}

/** Abre página nova quando o conteúdo não cabe mais. */
function garantirEspaco(ctx: Contexto, altura: number): void {
  if (ctx.y - altura > PE) return;
  novaPagina(ctx);
}

type OpcoesTexto = {
  tamanho?: number;
  fonte?: PDFFont;
  cor?: RGB;
  x?: number;
};

function escrever(ctx: Contexto, texto: string, opcoes: OpcoesTexto = {}): void {
  ctx.pagina.drawText(paraWinAnsi(texto), {
    x: opcoes.x ?? MARGEM,
    y: ctx.y,
    size: opcoes.tamanho ?? 10,
    font: opcoes.fonte ?? ctx.regular,
    color: opcoes.cor ?? TINTA,
  });
}

function direita(
  ctx: Contexto,
  texto: string,
  limite: number,
  opcoes: OpcoesTexto = {}
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

function centro(
  ctx: Contexto,
  texto: string,
  meio: number,
  opcoes: OpcoesTexto = {}
): void {
  const tamanho = opcoes.tamanho ?? 10;
  const fonte = opcoes.fonte ?? ctx.regular;
  const limpo = paraWinAnsi(texto);
  ctx.pagina.drawText(limpo, {
    x: meio - fonte.widthOfTextAtSize(limpo, tamanho) / 2,
    y: ctx.y,
    size: tamanho,
    font: fonte,
    color: opcoes.cor ?? TINTA,
  });
}

function caixa(
  ctx: Contexto,
  x: number,
  y: number,
  largura: number,
  altura: number,
  opcoes: { fundo?: RGB; borda?: RGB } = {}
): void {
  ctx.pagina.drawRectangle({
    x,
    y,
    width: largura,
    height: altura,
    color: opcoes.fundo,
    borderColor: opcoes.borda,
    borderWidth: opcoes.borda ? 0.8 : 0,
  });
}

function regua(ctx: Contexto, y: number, cor: RGB = BORDA): void {
  ctx.pagina.drawLine({
    start: { x: MARGEM, y },
    end: { x: MARGEM + LARGURA_UTIL, y },
    thickness: 0.6,
    color: cor,
  });
}

/**
 * Marcador de seção.
 *
 * O ponto cheio na cor da marca é o que amarra o documento à identidade
 * sem depender de fonte própria: repete em cada bloco e o olho reconhece.
 */
function secao(ctx: Contexto, titulo: string): void {
  garantirEspaco(ctx, 52);
  ctx.y -= 24;

  ctx.pagina.drawCircle({
    x: MARGEM + 3.5,
    y: ctx.y + 3,
    size: 3.5,
    color: ctx.cor,
  });

  escrever(ctx, titulo.toUpperCase(), {
    tamanho: 8.5,
    fonte: ctx.negrito,
    x: MARGEM + 13,
  });

  ctx.y -= 9;
  regua(ctx, ctx.y);
  ctx.y -= 15;
}

/** Item de lista, com o ponto alinhado ao texto ao lado. */
function marcador(ctx: Contexto, rotulo: string | null, texto: string): void {
  const recuo = MARGEM + 12;
  const prefixo = rotulo ? `${rotulo}: ` : "";
  const linhas = quebrar(prefixo + texto, ctx.regular, 9.5, LARGURA_UTIL - 12);

  garantirEspaco(ctx, linhas.length * 12 + 8);

  ctx.pagina.drawCircle({ x: MARGEM + 4, y: ctx.y + 3, size: 1.6, color: SUAVE });

  linhas.forEach((linha, i) => {
    if (i === 0 && rotulo) {
      // Rótulo em negrito e o resto normal, na mesma linha.
      const marca = `${rotulo}:`;
      escrever(ctx, marca, { tamanho: 9.5, fonte: ctx.negrito, x: recuo });
      escrever(ctx, linha.slice(prefixo.length), {
        tamanho: 9.5,
        cor: SUAVE,
        x: recuo + ctx.negrito.widthOfTextAtSize(paraWinAnsi(marca), 9.5) + 4,
      });
    } else {
      escrever(ctx, linha, { tamanho: 9.5, cor: SUAVE, x: recuo });
    }
    ctx.y -= 12;
  });
  ctx.y -= 3;
}

export async function gerarPdfOrcamento(
  empresa: DadosEmpresa,
  cliente: DadosCliente,
  orcamento: DadosOrcamento
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Orçamento ${orcamento.numero} — ${empresa.nome}`);
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

  const limite = MARGEM + LARGURA_UTIL;

  // ══════════════════ CABEÇALHO ══════════════════
  // Quem propõe à esquerda, o número do documento à direita: é onde o
  // olho procura cada um dos dois.
  const CAIXA_NUMERO = 168;
  const topo = ctx.y;

  let alturaLogo = 0;
  if (empresa.logo) {
    try {
      const img =
        empresa.logo.tipo === "png"
          ? await doc.embedPng(empresa.logo.bytes)
          : await doc.embedJpg(empresa.logo.bytes);
      const escala = Math.min(130 / img.width, 46 / img.height);
      alturaLogo = img.height * escala;
      ctx.pagina.drawImage(img, {
        x: MARGEM,
        y: topo - alturaLogo,
        width: img.width * escala,
        height: alturaLogo,
      });
    } catch {
      // Logo corrompido ou em formato inesperado não pode impedir a
      // proposta de sair: o documento vale sem ele.
      alturaLogo = 0;
    }
  }

  ctx.y = topo - alturaLogo - (alturaLogo > 0 ? 14 : 0);
  escrever(ctx, empresa.nome, { tamanho: 15, fonte: negrito, cor });
  ctx.y -= 13;

  const identificacao = [
    empresa.cnpj ? `CNPJ ${empresa.cnpj}` : null,
    empresa.endereco,
    [empresa.municipio, empresa.uf].filter(Boolean).join("/") || null,
    [empresa.telefone, empresa.email].filter(Boolean).join("  ·  ") || null,
  ].filter(Boolean) as string[];

  for (const linha of identificacao) {
    escrever(ctx, linha, { tamanho: 8.5, cor: SUAVE });
    ctx.y -= 10.5;
  }

  const fimEsquerda = ctx.y;

  const alturaCaixa = 58;
  const yCaixa = topo - alturaCaixa + 8;
  caixa(ctx, limite - CAIXA_NUMERO, yCaixa, CAIXA_NUMERO, alturaCaixa, { borda: BORDA });
  caixa(ctx, limite - CAIXA_NUMERO, yCaixa + alturaCaixa - 19, CAIXA_NUMERO, 19, {
    fundo: clarear(cor, 0.86),
  });

  ctx.y = yCaixa + alturaCaixa - 13;
  centro(ctx, "ORÇAMENTO Nº", limite - CAIXA_NUMERO / 2, {
    tamanho: 8,
    fonte: negrito,
  });
  ctx.y = yCaixa + 14;
  centro(ctx, String(orcamento.numero), limite - CAIXA_NUMERO / 2, {
    tamanho: 26,
    fonte: negrito,
    cor,
  });

  ctx.y = yCaixa - 12;
  direita(ctx, `Emitido em ${formatarData(orcamento.dataEmissao)}`, limite, {
    tamanho: 8.5,
    cor: SUAVE,
  });
  if (orcamento.validadeEm) {
    ctx.y -= 11;
    direita(ctx, `Válido até ${formatarData(orcamento.validadeEm)}`, limite, {
      tamanho: 9,
      fonte: negrito,
      cor,
    });
  }

  ctx.y = Math.min(fimEsquerda, ctx.y) - 6;

  // ══════════════════ CLIENTE ══════════════════
  secao(ctx, "Cliente");

  const linhasCliente: [string, string][] = [["Nome", cliente.nome ?? "Não informado"]];
  if (cliente.documento) linhasCliente.push(["CPF/CNPJ", cliente.documento]);
  if (cliente.telefone) linhasCliente.push(["Telefone", cliente.telefone]);
  if (cliente.email) linhasCliente.push(["E-mail", cliente.email]);

  const ALTURA_LINHA = 20;
  const COLUNA_ROTULO = 88;
  const alturaTabela = linhasCliente.length * ALTURA_LINHA;

  garantirEspaco(ctx, alturaTabela + 12);
  const topoTabela = ctx.y + 12;
  caixa(ctx, MARGEM, topoTabela - alturaTabela, LARGURA_UTIL, alturaTabela, {
    borda: BORDA,
  });
  caixa(ctx, MARGEM, topoTabela - alturaTabela, COLUNA_ROTULO, alturaTabela, {
    fundo: PAPEL,
  });

  linhasCliente.forEach(([rotulo, valor], i) => {
    const yLinha = topoTabela - (i + 1) * ALTURA_LINHA;
    if (i > 0) regua(ctx, yLinha + ALTURA_LINHA);
    ctx.y = yLinha + 6.5;
    escrever(ctx, rotulo, { tamanho: 8.5, fonte: negrito, x: MARGEM + 9 });
    escrever(ctx, valor, { tamanho: 9.5, x: MARGEM + COLUNA_ROTULO + 10 });
  });

  ctx.pagina.drawLine({
    start: { x: MARGEM + COLUNA_ROTULO, y: topoTabela },
    end: { x: MARGEM + COLUNA_ROTULO, y: topoTabela - alturaTabela },
    thickness: 0.6,
    color: BORDA,
  });

  ctx.y = topoTabela - alturaTabela - 4;

  // ══════════════════ OBJETO ══════════════════
  secao(
    ctx,
    orcamento.natureza === "servico" ? "Serviço proposto" : "Fornecimento proposto"
  );
  for (const linha of quebrar(orcamento.descricao, regular, 10.5, LARGURA_UTIL)) {
    garantirEspaco(ctx, 15);
    escrever(ctx, linha, { tamanho: 10.5 });
    ctx.y -= 13.5;
  }

  // ══════════════════ DETALHAMENTO ══════════════════
  const totais = calcularTotais(
    orcamento.itens,
    { valor: orcamento.desconto, percentual: orcamento.descontoPercentual },
    orcamento.valorTotal + orcamento.desconto
  );

  const colDesc = MARGEM + 34;
  const colQtd = MARGEM + 320;
  const colUnit = MARGEM + 420;

  function cabecalhoTabela() {
    caixa(ctx, MARGEM, ctx.y - 6, LARGURA_UTIL, 20, { fundo: clarear(cor, 0.88) });
    ctx.y += 1;
    escrever(ctx, "Nº", { tamanho: 8, fonte: negrito, x: MARGEM + 9 });
    escrever(ctx, "Descrição", { tamanho: 8, fonte: negrito, x: colDesc });
    direita(ctx, "Qtd", colQtd, { tamanho: 8, fonte: negrito });
    direita(ctx, "Valor un.", colUnit, { tamanho: 8, fonte: negrito });
    direita(ctx, "Total", limite - 9, { tamanho: 8, fonte: negrito });
    ctx.y -= 20;
  }

  if (orcamento.itens.length > 0) {
    secao(ctx, "Detalhamento");
    ctx.y -= 2;
    cabecalhoTabela();

    orcamento.itens.forEach((item, i) => {
      const linhas = quebrar(item.descricao, regular, 9.5, colQtd - colDesc - 16);
      const altura = Math.max(20, linhas.length * 12 + 8);

      // Tabela que atravessa a página repete o cabeçalho: sem isso a
      // segunda página vira uma lista de números sem rótulo.
      if (ctx.y - altura <= PE) {
        novaPagina(ctx);
        ctx.y -= 6;
        cabecalhoTabela();
      }

      const yTexto = ctx.y;
      const baseLinha = yTexto - altura + 14;

      // Zebra: em tabela longa, o olho perde a linha sem ela.
      if (i % 2 === 1) {
        caixa(ctx, MARGEM, baseLinha, LARGURA_UTIL, altura, { fundo: PAPEL });
      }

      escrever(ctx, String(i + 1), { tamanho: 9, cor: SUAVE, x: MARGEM + 9 });
      escrever(ctx, linhas[0], { tamanho: 9.5, x: colDesc });
      direita(
        ctx,
        `${formatarQuantidade(Number(item.quantidade))} ${item.unidade}`,
        colQtd,
        { tamanho: 9, cor: SUAVE }
      );
      direita(ctx, formatarMoeda(Number(item.valor_unitario)), colUnit, {
        tamanho: 9.5,
      });
      direita(ctx, formatarMoeda(Number(item.total)), limite - 9, {
        tamanho: 9.5,
        fonte: negrito,
      });

      ctx.y -= 12;
      for (const extra of linhas.slice(1)) {
        escrever(ctx, extra, { tamanho: 9.5, cor: SUAVE, x: colDesc });
        ctx.y -= 12;
      }

      ctx.y = baseLinha;
      regua(ctx, ctx.y);
    });

    ctx.y -= 4;
  }

  // ══════════════════ FECHAMENTO ══════════════════
  const LARGURA_TOTAIS = 236;
  const ALTURA_FAIXA = 34;
  const alturaTotais = totais.desconto > 0 ? ALTURA_FAIXA + 42 : ALTURA_FAIXA;

  garantirEspaco(ctx, alturaTotais + 24);
  ctx.y -= 14;

  const xTotais = limite - LARGURA_TOTAIS;
  const topoTotais = ctx.y + 12;
  caixa(ctx, xTotais, topoTotais - alturaTotais, LARGURA_TOTAIS, alturaTotais, {
    borda: BORDA,
  });

  if (totais.desconto > 0) {
    ctx.y = topoTotais - 16;
    escrever(ctx, "Subtotal", { tamanho: 9.5, cor: SUAVE, x: xTotais + 12 });
    direita(ctx, formatarMoeda(totais.subtotal), limite - 12, { tamanho: 9.5 });

    ctx.y -= 17;
    escrever(
      ctx,
      totais.percentualDesconto
        ? `Desconto (${totais.percentualDesconto.toLocaleString("pt-BR")}%)`
        : "Desconto",
      { tamanho: 9.5, cor: SUAVE, x: xTotais + 12 }
    );
    direita(ctx, `- ${formatarMoeda(totais.desconto)}`, limite - 12, {
      tamanho: 9.5,
      cor: SUAVE,
    });
  }

  // Faixa do total na cor da marca: é o número pelo qual a proposta
  // existe, e precisa se separar de tudo em volta.
  const yFaixa = topoTotais - alturaTotais;
  caixa(ctx, xTotais, yFaixa, LARGURA_TOTAIS, ALTURA_FAIXA, { fundo: cor });
  ctx.y = yFaixa + 12;
  escrever(ctx, "TOTAL", {
    tamanho: 10,
    fonte: negrito,
    cor: contrasteSobre(cor),
    x: xTotais + 12,
  });
  direita(ctx, formatarMoeda(totais.total), limite - 12, {
    tamanho: 15,
    fonte: negrito,
    cor: contrasteSobre(cor),
  });

  ctx.y = yFaixa - 8;

  // ══════════════════ CONDIÇÕES ══════════════════
  if (orcamento.condicoesPagamento || orcamento.prazoExecucao || orcamento.garantia) {
    secao(ctx, "Condições");
    if (orcamento.condicoesPagamento) {
      marcador(ctx, "Pagamento", orcamento.condicoesPagamento);
    }
    if (orcamento.prazoExecucao) marcador(ctx, "Prazo de execução", orcamento.prazoExecucao);
    if (orcamento.garantia) marcador(ctx, "Garantia", orcamento.garantia);
  }

  if (orcamento.observacoes) {
    secao(ctx, "Observações");
    marcador(ctx, null, orcamento.observacoes);
  }

  if (orcamento.linkAceite) {
    secao(ctx, "Aceitar pelo celular");
    marcador(ctx, null, `Abra este link e confirme: ${orcamento.linkAceite}`);
  }

  // ══════════════════ ASSINATURAS ══════════════════
  // Duas colunas, como no documento de papel: quem propõe de um lado,
  // quem aceita do outro. Dá para fechar impresso, sem link nenhum.
  garantirEspaco(ctx, 130);
  ctx.y -= 44;

  const meioEsq = MARGEM + LARGURA_UTIL / 4;
  const meioDir = MARGEM + (LARGURA_UTIL * 3) / 4;
  const larguraLinha = LARGURA_UTIL / 2 - 30;

  if (empresa.assinatura) {
    try {
      const img = await doc.embedPng(empresa.assinatura);
      const escala = Math.min(larguraLinha / img.width, 46 / img.height, 1);
      ctx.pagina.drawImage(img, {
        x: meioEsq - (img.width * escala) / 2,
        y: ctx.y + 6,
        width: img.width * escala,
        height: img.height * escala,
      });
    } catch {
      // Assinatura corrompida não pode impedir a proposta de sair: a
      // linha e o nome continuam valendo.
    }
  }

  for (const meio of [meioEsq, meioDir]) {
    ctx.pagina.drawLine({
      start: { x: meio - larguraLinha / 2, y: ctx.y },
      end: { x: meio + larguraLinha / 2, y: ctx.y },
      thickness: 0.8,
      color: SUAVE,
    });
  }

  ctx.y -= 13;
  centro(ctx, empresa.assinaturaNome ?? empresa.nome, meioEsq, {
    tamanho: 9.5,
    fonte: negrito,
  });
  centro(ctx, cliente.nome ?? "Cliente", meioDir, { tamanho: 9.5, fonte: negrito });

  ctx.y -= 11;
  if (empresa.assinaturaTitulo) {
    centro(ctx, empresa.assinaturaTitulo, meioEsq, { tamanho: 8.5, cor: SUAVE });
  }
  centro(ctx, "Aceite do cliente — assinatura e data", meioDir, {
    tamanho: 8.5,
    cor: SUAVE,
  });

  // ══════════════════ RODAPÉ ══════════════════
  const rodape = orcamento.validadeEm
    ? `Proposta válida até ${formatarData(orcamento.validadeEm)}. Após esta data os valores podem mudar.`
    : "Valores sujeitos a alteração sem aviso prévio.";

  const paginas = doc.getPages();
  paginas.forEach((pagina, i) => {
    pagina.drawLine({
      start: { x: MARGEM, y: MARGEM + 4 },
      end: { x: limite, y: MARGEM + 4 },
      thickness: 0.6,
      color: BORDA,
    });
    pagina.drawText(paraWinAnsi(rodape), {
      x: MARGEM,
      y: MARGEM - 8,
      size: 7.5,
      font: regular,
      color: SUAVE,
    });
    if (paginas.length > 1) {
      const numeracao = `${i + 1}/${paginas.length}`;
      pagina.drawText(numeracao, {
        x: limite - regular.widthOfTextAtSize(numeracao, 7.5),
        y: MARGEM - 8,
        size: 7.5,
        font: regular,
        color: SUAVE,
      });
    }
  });

  return doc.save();
}

/** "2" em vez de "2,00"; "1,5" quando é fracionado de verdade. */
function formatarQuantidade(valor: number): string {
  return Number.isInteger(valor)
    ? String(valor)
    : valor.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}
