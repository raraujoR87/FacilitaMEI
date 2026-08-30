/**
 * Fonte única dos planos: preço, limites e o que cada um entrega.
 *
 * A tela de vendas, a página de plano dentro do app e o limite aplicado no
 * upload de notas leem daqui. Mudar de preço é mexer num lugar só.
 */

export const LIMITE_NOTAS_FREE = 10;

export type IdPlano = "free" | "pro";

export type Plano = {
  id: IdPlano;
  nome: string;
  chamada: string;
  precoMensal: number;
  /** Preço por mês quando pago de uma vez no ano. */
  precoAnual: number;
  limiteNotas: number | null;
  destaques: string[];
};

export const PLANOS: Record<IdPlano, Plano> = {
  free: {
    id: "free",
    nome: "Grátis",
    chamada: "Para começar a organizar hoje",
    precoMensal: 0,
    precoAnual: 0,
    limiteNotas: LIMITE_NOTAS_FREE,
    destaques: [
      `${LIMITE_NOTAS_FREE} notas lidas por foto no mês`,
      "Lançamentos manuais ilimitados",
      "Recibos e orçamentos com numeração própria",
      "Cobrança com PIX copia e cola",
      "Relatório mensal em PDF e planilha",
    ],
  },
  pro: {
    id: "pro",
    nome: "Pro",
    chamada: "Para quem não quer nem pensar em planilha",
    precoMensal: 29.9,
    precoAnual: 24.9,
    limiteNotas: null,
    destaques: [
      "Notas lidas por foto sem limite",
      "Tudo do plano grátis",
      "Envio da cobrança pelo WhatsApp",
      "Suporte por WhatsApp",
    ],
  },
};

/** Quanto o anual economiza no ano, em reais. */
export function economiaAnual(): number {
  return (PLANOS.pro.precoMensal - PLANOS.pro.precoAnual) * 12;
}

/**
 * Link de pagamento do gateway (Asaas, Mercado Pago, Stripe...).
 *
 * Todos oferecem link estático de assinatura, o que dispensa integração de
 * API para começar a vender. Enquanto não estiver configurado, a tela de
 * planos orienta o contato direto em vez de mostrar um botão quebrado.
 */
export function linkAssinatura(ciclo: "mensal" | "anual"): string | null {
  const link =
    ciclo === "anual"
      ? process.env.NEXT_PUBLIC_LINK_ASSINATURA_ANUAL
      : process.env.NEXT_PUBLIC_LINK_ASSINATURA_MENSAL;

  return link && link.startsWith("http") ? link : null;
}

export function contatoWhatsApp(): string | null {
  const numero = process.env.NEXT_PUBLIC_WHATSAPP_CONTATO?.replace(/\D/g, "");
  if (!numero || numero.length < 10) return null;
  const comDdi = numero.startsWith("55") ? numero : `55${numero}`;
  return `https://wa.me/${comDdi}`;
}
