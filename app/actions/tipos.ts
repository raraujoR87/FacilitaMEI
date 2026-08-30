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
