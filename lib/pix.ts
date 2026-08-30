/**
 * Geração de BR Code — o "PIX copia e cola" do Banco Central.
 *
 * O payload segue o padrão EMV®QRCPS: campos no formato ID + tamanho (2
 * dígitos) + valor, encerrados por um CRC16 do próprio payload. Como é um
 * QR estático assinado apenas pelo CRC, não há chamada de rede nem
 * intermediário financeiro: o valor cai direto na chave do MEI.
 */

export type TipoChavePix = "cpf" | "cnpj" | "email" | "telefone" | "aleatoria";

function campo(id: string, valor: string): string {
  return id + String(valor.length).padStart(2, "0") + valor;
}

/**
 * CRC16/CCITT-FALSE (polinômio 0x1021, inicial 0xFFFF) — o exigido pelo
 * padrão. O payload é ASCII puro nesse ponto, então charCodeAt basta.
 */
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

/** O padrão aceita apenas ASCII imprimível nos campos de nome e cidade. */
function apenasAscii(texto: string, tamanhoMaximo: number): string {
  return texto
    // NFD separa o acento da letra; o filtro seguinte descarta o acento.
    .normalize("NFD")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .trim()
    .toUpperCase()
    .slice(0, tamanhoMaximo);
}

/** Cada tipo de chave tem um formato canônico esperado pelos bancos. */
export function normalizarChavePix(chave: string, tipo: TipoChavePix): string {
  const limpa = chave.trim();
  switch (tipo) {
    case "cpf":
    case "cnpj":
      return limpa.replace(/\D/g, "");
    case "telefone": {
      const digitos = limpa.replace(/\D/g, "");
      // Sem DDI o banco rejeita a chave; 55 é assumido para números locais.
      return digitos.startsWith("55") ? `+${digitos}` : `+55${digitos}`;
    }
    case "email":
      return limpa.toLowerCase();
    case "aleatoria":
      return limpa.toLowerCase();
  }
}

export type DadosPix = {
  chave: string;
  tipoChave: TipoChavePix;
  nomeTitular: string;
  cidade: string;
  valor?: number;
  /** Identificador da cobrança; vira a referência no extrato. */
  identificador?: string;
};

export function gerarBrCode({
  chave,
  tipoChave,
  nomeTitular,
  cidade,
  valor,
  identificador,
}: DadosPix): string {
  const contaMerchante =
    campo("00", "br.gov.bcb.pix") +
    campo("01", normalizarChavePix(chave, tipoChave));

  const referencia =
    apenasAscii(identificador ?? "", 25).replace(/ /g, "") || "***";

  let payload =
    campo("00", "01") +
    campo("01", "12") + // uso único: o QR vale para uma cobrança
    campo("26", contaMerchante) +
    campo("52", "0000") + // categoria do estabelecimento: não informada
    campo("53", "986") + // BRL
    (valor && valor > 0 ? campo("54", valor.toFixed(2)) : "") +
    campo("58", "BR") +
    campo("59", apenasAscii(nomeTitular, 25) || "MEI") +
    campo("60", apenasAscii(cidade, 15) || "SAO PAULO") +
    campo("62", campo("05", referencia));

  // O CRC cobre o payload inteiro, incluindo o próprio "6304".
  payload += "6304";
  return payload + crc16(payload);
}

/** O perfil só consegue emitir cobrança com esses campos preenchidos. */
export function perfilTemPix(perfil: {
  chave_pix: string | null;
  tipo_chave_pix: string | null;
  nome_titular_pix: string | null;
}): boolean {
  return Boolean(
    perfil.chave_pix && perfil.tipo_chave_pix && perfil.nome_titular_pix
  );
}
