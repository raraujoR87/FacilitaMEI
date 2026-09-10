/**
 * Deixa o texto seguro para as fontes padrão do PDF.
 *
 * As fontes embutidas do PDF usam WinAnsi, que não cobre todo o Unicode.
 * `pdf-lib` não ignora o que não cabe: ele lança. Sem esta limpeza, um
 * cliente cadastrado com emoji no nome, ou uma observação colada de outro
 * lugar com um traço tipográfico incomum, derruba a rota inteira — e o
 * MEI descobre isso na frente do cliente, tentando mandar a proposta.
 *
 * A escolha é trocar por um equivalente legível sempre que existe, e só
 * descartar o que não tem tradução.
 */

/** Trocas onde existe um equivalente que o leitor nem percebe. */
const EQUIVALENTES: Record<string, string> = {
  "−": "-", // sinal de menos matemático
  "‒": "-",
  "―": "-",
  " ": " ", // espaço não separável, que o Intl usa em "R$ 1.234,00"
  " ": " ",
  " ": " ",
  " ": " ",
  "→": "->",
  "←": "<-",
  "⇒": "=>",
  "≤": "<=",
  "≥": ">=",
  "×": "x",
  "⁄": "/",
  " ": " ",
  " ": " ",
};

/**
 * Além do Latin-1, o WinAnsi tem estas posições altas — inclusive as
 * aspas curvas e as reticências, que aparecem em texto colado do Word.
 */
const EXTRAS_WINANSI = new Set([
  0x0152, 0x0153, 0x0160, 0x0161, 0x0178, 0x017d, 0x017e, 0x0192, 0x02c6,
  0x02dc, 0x2013, 0x2014, 0x2018, 0x2019, 0x201a, 0x201c, 0x201d, 0x201e,
  0x2020, 0x2021, 0x2022, 0x2026, 0x2030, 0x2039, 0x203a, 0x20ac, 0x2122,
]);

function encaixa(ponto: number): boolean {
  if (ponto === 0x0a) return true; // quebra de linha é tratada na diagramação
  if (ponto < 0x20 || ponto === 0x7f) return false; // controle
  if (ponto <= 0xff) return true; // Latin-1, que cobre o português
  return EXTRAS_WINANSI.has(ponto);
}

export function paraWinAnsi(texto: string | null | undefined): string {
  if (!texto) return "";

  let saida = "";
  // `for...of` percorre por ponto de código: um emoji é um par substituto,
  // e varrer por índice partiria ele em dois caracteres inválidos.
  for (const caractere of texto.normalize("NFC")) {
    const trocado = EQUIVALENTES[caractere];
    if (trocado !== undefined) {
      saida += trocado;
      continue;
    }

    const ponto = caractere.codePointAt(0)!;
    if (encaixa(ponto)) saida += caractere;
    // O resto — emoji, alfabetos não latinos, símbolos raros — é
    // descartado em silêncio. Melhor um nome sem o emoji do que uma
    // proposta que não sai.
  }

  return saida;
}
