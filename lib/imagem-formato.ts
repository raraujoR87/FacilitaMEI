/**
 * Que formato a imagem é, de verdade.
 *
 * Existe por um bug que custou o logo de um cliente real: o arquivo era
 * WebP, o código deduzia o formato pelo `content-type` do cabeçalho e
 * chamava `embedJpg`. O `pdf-lib` recusava, o `try/catch` engolia, e o
 * logo simplesmente não aparecia no PDF — sem erro em lugar nenhum.
 *
 * Cabeçalho HTTP é o que o servidor DIZ; os primeiros bytes são o que o
 * arquivo É. Num formato que o PDF não aceita, é melhor saber antes de
 * tentar do que descobrir por ausência.
 */
export type FormatoImagem = "png" | "jpg" | "webp" | "gif" | "svg" | null;

export function detectarFormato(bytes: Uint8Array): FormatoImagem {
  if (bytes.length < 12) return null;

  // \x89 P N G \r \n \x1a \n
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "png";
  }

  // Todo JPEG começa com SOI (FF D8) seguido de um marcador (FF).
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";

  // RIFF....WEBP
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "webp";
  }

  // GIF87a / GIF89a
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "gif";

  // SVG é texto: procura a tag no começo, tolerando BOM, espaço e a
  // declaração XML antes dela.
  const inicio = new TextDecoder("utf-8", { fatal: false })
    .decode(bytes.slice(0, 512))
    .trimStart();
  if (inicio.startsWith("<?xml") || inicio.startsWith("<svg")) {
    return inicio.includes("<svg") ? "svg" : null;
  }

  return null;
}

/** Os únicos que o pdf-lib embute. */
export function cabeNoPdf(formato: FormatoImagem): formato is "png" | "jpg" {
  return formato === "png" || formato === "jpg";
}
