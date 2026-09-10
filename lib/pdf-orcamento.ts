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
 * CONVENÇÃO DE DIAGRAMAÇÃO, que a primeira versão não tinha e por isso
 * saiu com as linhas da tabela se sobrepondo: `ctx.y` é sempre a LINHA DE
 * BASE do próximo texto a desenhar. Blocos com altura própria (tabelas,
 * caixas) calculam topo e base explicitamente e devolvem `ctx.y` na base.
 * Misturar as duas leituras é o que fazia a linha avançar 6pt em vez de 20.
 */

const A4 = { largura: 595.28, altura: 841.89 };
const MARGEM = 42;
const LARGURA_UTIL = A4.largura - MARGEM * 2;
/** Espaço reservado no pé para o rodapé não encostar no conteúdo. */
const PE = MARGEM + 26;

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
 * das marcas.
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
 * Cabeçalho de seção.
 *
 * O ponto cheio na cor da marca é o que amarra o documento à identidade
 * sem depender de fonte própria: repete em cada bloco e o olho reconhece.
 *
 * `reserva` é a altura do conteúdo que vem logo abaixo. Sem ela o título
 * cabia no fim da página e o conteúdo ia para a seguinte — o documento
 * saía com uma seção de cabeçalho vazio no pé.
 */
function secao(ctx: Contexto, titulo: string, reserva = 30): void {
  garantirEspaco(ctx, 30 + reserva);
  ctx.y -= 20;

  ctx.pagina.drawCircle({
    x: MARGEM + 3.2,
    y: ctx.y + 2.8,
    size: 3.2,
    color: ctx.cor,
  });

  escrever(ctx, titulo.toUpperCase(), {
    tamanho: 8.5,
    fonte: ctx.negrito,
    x: MARGEM + 12,
  });

  ctx.y -= 7;
  regua(ctx, ctx.y);
  ctx.y -= 13;
}

/** Item de lista, com o ponto alinhado à primeira linha do texto. */
function marcador(ctx: Contexto, rotulo: string | null, texto: string): void {
  const recuo = MARGEM + 11;
  const prefixo = rotulo ? `${rotulo}: ` : "";
  const linhas = quebrar(prefixo + texto, ctx.regular, 9, LARGURA_UTIL - 11);

  garantirEspaco(ctx, linhas.length * 11.5 + 6);

  ctx.pagina.drawCircle({ x: MARGEM + 3.5, y: ctx.y + 2.8, size: 1.5, color: SUAVE });

  linhas.forEach((linha, i) => {
    if (i === 0 && rotulo) {
      const marca = `${rotulo}:`;
      escrever(ctx, marca, { tamanho: 9, fonte: ctx.negrito, x: recuo });
      escrever(ctx, linha.slice(prefixo.length), {
        tamanho: 9,
        cor: SUAVE,
        x: recuo + ctx.negrito.widthOfTextAtSize(paraWinAnsi(marca), 9) + 4,
      });
    } else {
      escrever(ctx, linha, { tamanho: 9, cor: SUAVE, x: recuo });
    }
    ctx.y -= 11.5;
  });
  ctx.y -= 2;
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
  const CAIXA_NUMERO = 150;
  const ALTURA_CAIXA = 52;
  const topo = ctx.y;

  const yCaixa = topo - ALTURA_CAIXA;
  caixa(ctx, limite - CAIXA_NUMERO, yCaixa, CAIXA_NUMERO, ALTURA_CAIXA, { borda: BORDA });
  caixa(ctx, limite - CAIXA_NUMERO, yCaixa + ALTURA_CAIXA - 17, CAIXA_NUMERO, 17, {
    fundo: clarear(cor, 0.86),
  });

  ctx.y = yCaixa + ALTURA_CAIXA - 12;
  centro(ctx, "ORÇAMENTO Nº", limite - CAIXA_NUMERO / 2, { tamanho: 7.5, fonte: negrito });
  ctx.y = yCaixa + 12;
  centro(ctx, String(orcamento.numero), limite - CAIXA_NUMERO / 2, {
    tamanho: 22,
    fonte: negrito,
    cor,
  });

  ctx.y = yCaixa - 12;
  direita(ctx, `Emitido em ${formatarData(orcamento.dataEmissao)}`, limite, {
    tamanho: 8,
    cor: SUAVE,
  });
  if (orcamento.validadeEm) {
    ctx.y -= 11;
    direita(ctx, `Válido até ${formatarData(orcamento.validadeEm)}`, limite, {
      tamanho: 8.5,
      fonte: negrito,
      cor,
    });
  }
  const fimDireita = ctx.y;

  // Coluna da esquerda desenhada depois, para ficar independente da altura
  // da caixa: quem tem logo alto não empurra o número para baixo.
  let yEsq = topo;
  if (empresa.logo) {
    try {
      const img =
        empresa.logo.tipo === "png"
          ? await doc.embedPng(empresa.logo.bytes)
          : await doc.embedJpg(empresa.logo.bytes);
      const escala = Math.min(120 / img.width, 40 / img.height);
      const altura = img.height * escala;
      ctx.pagina.drawImage(img, {
        x: MARGEM,
        y: yEsq - altura,
        width: img.width * escala,
        height: altura,
      });
      yEsq -= altura + 16;
    } catch {
      // Logo corrompido ou em formato inesperado não pode impedir a
      // proposta de sair: o documento vale sem ele.
    }
  }

  ctx.y = yEsq - 3;
  escrever(ctx, empresa.nome, { tamanho: 14, fonte: negrito, cor });
  ctx.y -= 13;

  const identificacao = [
    empresa.cnpj ? `CNPJ ${empresa.cnpj}` : null,
    empresa.endereco,
    [empresa.municipio, empresa.uf].filter(Boolean).join("/") || null,
    [empresa.telefone, empresa.email].filter(Boolean).join("  ·  ") || null,
  ].filter(Boolean) as string[];

  for (const linha of identificacao) {
    escrever(ctx, linha, { tamanho: 8, cor: SUAVE });
    ctx.y -= 10;
  }

  ctx.y = Math.min(ctx.y, fimDireita) - 2;

  // ══════════════════ CLIENTE ══════════════════
  const linhasCliente: [string, string][] = [["Nome", cliente.nome ?? "Não informado"]];
  if (cliente.documento) linhasCliente.push(["CPF/CNPJ", cliente.documento]);
  if (cliente.telefone) linhasCliente.push(["Telefone", cliente.telefone]);
  if (cliente.email) linhasCliente.push(["E-mail", cliente.email]);

  const ALTURA_LINHA = 17;
  const COLUNA_ROTULO = 82;
  const alturaTabela = linhasCliente.length * ALTURA_LINHA;

  secao(ctx, "Cliente", alturaTabela);

  const topoTabela = ctx.y + 11;
  caixa(ctx, MARGEM, topoTabela - alturaTabela, LARGURA_UTIL, alturaTabela, {
    borda: BORDA,
  });
  caixa(ctx, MARGEM, topoTabela - alturaTabela, COLUNA_ROTULO, alturaTabela, {
    fundo: PAPEL,
  });

  linhasCliente.forEach(([rotulo, valor], i) => {
    const baseLinha = topoTabela - (i + 1) * ALTURA_LINHA;
    if (i > 0) regua(ctx, baseLinha + ALTURA_LINHA);
    ctx.y = baseLinha + 5.5;
    escrever(ctx, rotulo, { tamanho: 8, fonte: negrito, x: MARGEM + 8 });
    escrever(ctx, valor, { tamanho: 9, x: MARGEM + COLUNA_ROTULO + 9 });
  });

  ctx.pagina.drawLine({
    start: { x: MARGEM + COLUNA_ROTULO, y: topoTabela },
    end: { x: MARGEM + COLUNA_ROTULO, y: topoTabela - alturaTabela },
    thickness: 0.6,
    color: BORDA,
  });

  ctx.y = topoTabela - alturaTabela - 2;

  // ══════════════════ OBJETO ══════════════════
  const linhasObjeto = quebrar(orcamento.descricao, regular, 10, LARGURA_UTIL);
  secao(
    ctx,
    orcamento.natureza === "servico" ? "Serviço proposto" : "Fornecimento proposto",
    linhasObjeto.length * 13
  );
  for (const linha of linhasObjeto) {
    escrever(ctx, linha, { tamanho: 10 });
    ctx.y -= 13;
  }

  // ══════════════════ DETALHAMENTO ══════════════════
  const totais = calcularTotais(
    orcamento.itens,
    { valor: orcamento.desconto, percentual: orcamento.descontoPercentual },
    orcamento.valorTotal + orcamento.desconto
  );

  const colDesc = MARGEM + 30;
  const colQtd = MARGEM + 318;
  const colUnit = MARGEM + 415;
  const ALTURA_CABECALHO = 18;

  /** `ctx.y` entra e sai na borda inferior, como nas linhas da tabela. */
  function cabecalhoTabela() {
    const topoCab = ctx.y;
    caixa(ctx, MARGEM, topoCab - ALTURA_CABECALHO, LARGURA_UTIL, ALTURA_CABECALHO, {
      fundo: clarear(cor, 0.88),
    });
    ctx.y = topoCab - 12.5;
    escrever(ctx, "Nº", { tamanho: 7.5, fonte: negrito, x: MARGEM + 8 });
    escrever(ctx, "Descrição", { tamanho: 7.5, fonte: negrito, x: colDesc });
    direita(ctx, "Qtd", colQtd, { tamanho: 7.5, fonte: negrito });
    direita(ctx, "Valor un.", colUnit, { tamanho: 7.5, fonte: negrito });
    direita(ctx, "Total", limite - 8, { tamanho: 7.5, fonte: negrito });
    ctx.y = topoCab - ALTURA_CABECALHO;
  }

  if (orcamento.itens.length > 0) {
    secao(ctx, "Detalhamento", ALTURA_CABECALHO + 42);
    ctx.y += 2;
    cabecalhoTabela();

    orcamento.itens.forEach((item, i) => {
      const linhas = quebrar(item.descricao, regular, 9, colQtd - colDesc - 14);
      // Altura vinda do conteúdo. O cálculo antigo somava um ajuste fixo e
      // fazia a linha avançar 6pt em vez de 20: as linhas se sobrepunham e
      // os primeiros itens sumiam da tabela.
      const altura = Math.max(19, 8 + linhas.length * 11.5);

      // Tabela que atravessa a página repete o cabeçalho: sem isso a
      // segunda página vira uma lista de números sem rótulo.
      if (ctx.y - altura < PE) {
        novaPagina(ctx);
        cabecalhoTabela();
      }

      const topoLinha = ctx.y;
      const baseLinha = topoLinha - altura;

      // Zebra: em tabela longa, o olho perde a linha sem ela.
      if (i % 2 === 1) {
        caixa(ctx, MARGEM, baseLinha, LARGURA_UTIL, altura, { fundo: PAPEL });
      }

      ctx.y = topoLinha - 13;
      escrever(ctx, String(i + 1), { tamanho: 8.5, cor: SUAVE, x: MARGEM + 8 });
      escrever(ctx, linhas[0], { tamanho: 9, x: colDesc });
      direita(
        ctx,
        `${formatarQuantidade(Number(item.quantidade))} ${item.unidade}`,
        colQtd,
        { tamanho: 8.5, cor: SUAVE }
      );
      direita(ctx, formatarMoeda(Number(item.valor_unitario)), colUnit, { tamanho: 9 });
      direita(ctx, formatarMoeda(Number(item.total)), limite - 8, {
        tamanho: 9,
        fonte: negrito,
      });

      for (const extra of linhas.slice(1)) {
        ctx.y -= 11.5;
        escrever(ctx, extra, { tamanho: 9, cor: SUAVE, x: colDesc });
      }

      ctx.y = baseLinha;
      regua(ctx, baseLinha);
    });
  }

  // ══════════════════ FECHAMENTO ══════════════════
  const LARGURA_TOTAIS = 220;
  const ALTURA_FAIXA = 30;
  const alturaTotais = totais.desconto > 0 ? ALTURA_FAIXA + 38 : ALTURA_FAIXA;

  garantirEspaco(ctx, alturaTotais + 16);
  ctx.y -= 12;

  const xTotais = limite - LARGURA_TOTAIS;
  const topoTotais = ctx.y;
  const baseTotais = topoTotais - alturaTotais;

  caixa(ctx, xTotais, baseTotais, LARGURA_TOTAIS, alturaTotais, { borda: BORDA });

  if (totais.desconto > 0) {
    ctx.y = topoTotais - 15;
    escrever(ctx, "Subtotal", { tamanho: 9, cor: SUAVE, x: xTotais + 11 });
    direita(ctx, formatarMoeda(totais.subtotal), limite - 11, { tamanho: 9 });

    ctx.y -= 15;
    escrever(
      ctx,
      totais.percentualDesconto
        ? `Desconto (${totais.percentualDesconto.toLocaleString("pt-BR")}%)`
        : "Desconto",
      { tamanho: 9, cor: SUAVE, x: xTotais + 11 }
    );
    direita(ctx, `- ${formatarMoeda(totais.desconto)}`, limite - 11, {
      tamanho: 9,
      cor: SUAVE,
    });
  }

  // Faixa do total na cor da marca: é o número pelo qual a proposta
  // existe, e precisa se separar de tudo em volta.
  caixa(ctx, xTotais, baseTotais, LARGURA_TOTAIS, ALTURA_FAIXA, { fundo: cor });
  ctx.y = baseTotais + 10.5;
  escrever(ctx, "TOTAL", {
    tamanho: 9.5,
    fonte: negrito,
    cor: contrasteSobre(cor),
    x: xTotais + 11,
  });
  direita(ctx, formatarMoeda(totais.total), limite - 11, {
    tamanho: 14,
    fonte: negrito,
    cor: contrasteSobre(cor),
  });

  // O link do aceite ocupa a faixa vazia à esquerda dos totais. Antes
  // ficava acima das assinaturas e era justamente ele que empurrava o
  // bloco inteiro para uma segunda página quase em branco.
  if (orcamento.linkAceite) {
    const larguraLink = xTotais - MARGEM - 18;
    ctx.y = topoTotais - 15;
    escrever(ctx, "Prefere aceitar pelo celular?", {
      tamanho: 8.5,
      fonte: negrito,
      cor: SUAVE,
    });
    ctx.y -= 11;
    for (const linha of quebrar(orcamento.linkAceite, regular, 7.5, larguraLink)) {
      escrever(ctx, linha, { tamanho: 7.5, cor });
      ctx.y -= 9.5;
    }
  }

  ctx.y = baseTotais;

  // ══════════════════ CONDIÇÕES ══════════════════
  const condicoes: [string, string][] = [];
  if (orcamento.condicoesPagamento) {
    condicoes.push(["Pagamento", orcamento.condicoesPagamento]);
  }
  if (orcamento.prazoExecucao) condicoes.push(["Prazo de execução", orcamento.prazoExecucao]);
  if (orcamento.garantia) condicoes.push(["Garantia", orcamento.garantia]);

  if (condicoes.length > 0) {
    secao(ctx, "Condições", condicoes.length * 14);
    for (const [rotulo, texto] of condicoes) marcador(ctx, rotulo, texto);
  }

  if (orcamento.observacoes) {
    secao(ctx, "Observações", 26);
    marcador(ctx, null, orcamento.observacoes);
  }

  // ══════════════════ ASSINATURAS ══════════════════
  // Duas colunas, como no documento de papel: quem propõe de um lado,
  // quem aceita do outro. Dá para fechar impresso, sem link nenhum.
  //
  // O bloco inteiro é reservado de uma vez: assinatura órfã no topo de uma
  // página em branco é pior do que uma quebra um pouco antes.
  const ALTURA_ASSINATURAS = 76;
  garantirEspaco(ctx, ALTURA_ASSINATURAS);

  // Ancorado no pé da folha quando sobra espaço: assinatura no fim da
  // página é a convenção do documento em papel, e sem isso ficava uma
  // faixa branca larga entre as observações e as linhas.
  const topoNoPe = PE + ALTURA_ASSINATURAS;
  ctx.y = ctx.y - 20 > topoNoPe ? topoNoPe : ctx.y - 20;

  const meioEsq = MARGEM + LARGURA_UTIL / 4;
  const meioDir = MARGEM + (LARGURA_UTIL * 3) / 4;
  const larguraLinha = LARGURA_UTIL / 2 - 34;
  // A linha fica no pé do espaço da assinatura; o desenho vai acima dela.
  const yLinhaAssinatura = ctx.y - 30;

  if (empresa.assinatura) {
    try {
      const img = await doc.embedPng(empresa.assinatura);
      const escala = Math.min(larguraLinha / img.width, 34 / img.height, 1);
      ctx.pagina.drawImage(img, {
        x: meioEsq - (img.width * escala) / 2,
        y: yLinhaAssinatura + 4,
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
      start: { x: meio - larguraLinha / 2, y: yLinhaAssinatura },
      end: { x: meio + larguraLinha / 2, y: yLinhaAssinatura },
      thickness: 0.8,
      color: SUAVE,
    });
  }

  ctx.y = yLinhaAssinatura - 12;
  centro(ctx, empresa.assinaturaNome ?? empresa.nome, meioEsq, {
    tamanho: 9,
    fonte: negrito,
  });
  centro(ctx, cliente.nome ?? "Cliente", meioDir, { tamanho: 9, fonte: negrito });

  ctx.y -= 10.5;
  if (empresa.assinaturaTitulo) {
    centro(ctx, empresa.assinaturaTitulo, meioEsq, { tamanho: 8, cor: SUAVE });
  }
  centro(ctx, "Aceite do cliente — assinatura e data", meioDir, {
    tamanho: 8,
    cor: SUAVE,
  });

  // ══════════════════ RODAPÉ ══════════════════
  const rodape = orcamento.validadeEm
    ? `Proposta válida até ${formatarData(orcamento.validadeEm)}. Após esta data os valores podem mudar.`
    : "Valores sujeitos a alteração sem aviso prévio.";

  const paginas = doc.getPages();
  paginas.forEach((pagina, i) => {
    pagina.drawLine({
      start: { x: MARGEM, y: MARGEM + 2 },
      end: { x: limite, y: MARGEM + 2 },
      thickness: 0.6,
      color: BORDA,
    });
    pagina.drawText(paraWinAnsi(rodape), {
      x: MARGEM,
      y: MARGEM - 9,
      size: 7,
      font: regular,
      color: SUAVE,
    });
    if (paginas.length > 1) {
      const numeracao = `${i + 1}/${paginas.length}`;
      pagina.drawText(numeracao, {
        x: limite - regular.widthOfTextAtSize(numeracao, 7),
        y: MARGEM - 9,
        size: 7,
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
