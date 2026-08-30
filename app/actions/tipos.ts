/** Resultado padrão das Server Actions, consumido por `useActionState`. */
export type EstadoForm = {
  erro?: string;
  sucesso?: string;
};

export const ESTADO_INICIAL: EstadoForm = {};

/** Converte o campo de valor (enviado em reais, com ponto decimal) em número. */
export function lerValor(formData: FormData, campo = "valor"): number | null {
  const bruto = String(formData.get(campo) ?? "").trim();
  if (!bruto) return null;
  const numero = Number(bruto);
  if (!Number.isFinite(numero) || numero < 0) return null;
  // Centavos são a menor unidade que faz sentido aqui.
  return Math.round(numero * 100) / 100;
}

export function lerTexto(formData: FormData, campo: string): string {
  return String(formData.get(campo) ?? "").trim();
}

/** Campos de select vazios chegam como "" e precisam virar null na coluna FK. */
export function lerOpcional(formData: FormData, campo: string): string | null {
  const valor = lerTexto(formData, campo);
  return valor === "" ? null : valor;
}

/**
 * Traduz os limites impostos por gatilho no banco.
 *
 * A regra vive lá porque esconder o botão na tela não é controle de acesso.
 * O custo é que a mensagem chega crua, em texto de exceção do Postgres — e
 * é aqui que ela vira uma frase que ajuda a pessoa a decidir.
 */
export function mensagemDeLimite(mensagem: string | undefined): string | null {
  if (!mensagem) return null;

  if (mensagem.includes("ate 5 clientes")) {
    return "O plano grátis guarda até 5 clientes. Seus clientes atuais continuam salvos — o Pro libera quantos você precisar.";
  }
  if (mensagem.includes("ate 3 itens")) {
    return "O plano grátis detalha até 3 itens por documento. No Pro o orçamento pode ter quantas linhas precisar.";
  }
  if (mensagem.includes("link publico")) {
    return "O link para o cliente é um recurso do plano Pro.";
  }
  if (mensagem.includes("personalizar a marca")) {
    return "Personalizar o recibo com sua marca é um recurso do plano Pro.";
  }
  return null;
}
