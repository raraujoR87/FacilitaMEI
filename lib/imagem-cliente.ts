/**
 * Converte qualquer imagem para PNG, no navegador.
 *
 * O upload aceita WebP e SVG porque é o que a pessoa tem em mãos — mas o
 * `pdf-lib` só embute PNG e JPG, e um logo WebP sumia do PDF sem avisar.
 * Converter na hora do envio resolve na origem: o que chega ao Storage já
 * é PNG, e todo lugar que consome o logo funciona.
 *
 * No navegador, e não no servidor, porque a conversão sai de graça: o
 * `canvas` já decodifica WebP, JPEG e SVG, sem dependência nova nem
 * processamento na função serverless.
 */

/** Largura máxima. Logo maior que isso é peso sem ganho visível. */
const LARGURA_MAXIMA = 600;

function carregar(fonte: string, comCors: boolean): Promise<HTMLImageElement> {
  return new Promise((resolver, rejeitar) => {
    const img = new Image();
    // Sem isto, desenhar uma imagem de outro domínio "suja" o canvas e
    // `toDataURL` lança — que é o caso do logo já guardado no Storage.
    if (comCors) img.crossOrigin = "anonymous";
    img.onload = () => resolver(img);
    img.onerror = () => rejeitar(new Error("não deu para ler a imagem"));
    img.src = fonte;
  });
}

function desenhar(img: HTMLImageElement): string {
  // SVG sem largura intrínseca chega com 0: sem um tamanho de referência,
  // o canvas sairia vazio.
  const larguraOriginal = img.naturalWidth || LARGURA_MAXIMA;
  const alturaOriginal = img.naturalHeight || LARGURA_MAXIMA / 2;

  const escala = Math.min(1, LARGURA_MAXIMA / larguraOriginal);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(larguraOriginal * escala);
  canvas.height = Math.round(alturaOriginal * escala);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas indisponível");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return canvas.toDataURL("image/png");
}

/** Arquivo escolhido pela pessoa → data URL PNG. */
export async function arquivoParaPng(arquivo: File): Promise<string> {
  const fonte = URL.createObjectURL(arquivo);
  try {
    return desenhar(await carregar(fonte, false));
  } finally {
    URL.revokeObjectURL(fonte);
  }
}

/**
 * Logo já guardado no Storage → data URL PNG.
 *
 * Serve para consertar quem enviou o logo antes desta conversão existir,
 * sem obrigar a pessoa a procurar o arquivo original de novo.
 */
export async function urlParaPng(url: string): Promise<string> {
  return desenhar(await carregar(url, true));
}
