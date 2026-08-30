/**
 * Fonte única dos planos: preço, limites e o que cada um entrega.
 *
 * A tela de vendas, a página de plano dentro do app e o limite aplicado no
 * upload de notas leem daqui. Mudar de preço é mexer num lugar só.
 */

export const LIMITE_NOTAS_FREE = 10;

/**
 * Teto de uso justo do Pro.
 *
 * "Ilimitado" era custo variável sem freio: cada nota lida custa IA, e um
 * volume muito acima do padrão de um MEI custaria mais do que a mensalidade.
 * O número é folgado de propósito — um MEI real não chega perto.
 */
export const LIMITE_NOTAS_PRO = 300;

/** Dias de Pro dados no cadastro. */
export const DIAS_DE_TESTE = 14;

/**
 * Limites de escala do plano grátis.
 *
 * Limitam por tamanho, não por função: quem cresceu esbarra, quem está
 * começando não sente. O concorrente aqui é o caderno e o WhatsApp — grátis
 * capado demais faz voltar para o papel, e aí não há o que converter.
 *
 * Editar registro fica de fora de propósito: erro de digitação que não dá
 * para corrigir gera raiva, e atinge justamente o iniciante.
 */
export const LIMITES_FREE = {
  clientes: 5,
  itensPorDocumento: 3,
} as const;

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
    chamada: "Para o MEI que trabalha sozinho",
    precoMensal: 0,
    precoAnual: 0,
    limiteNotas: LIMITE_NOTAS_FREE,
    destaques: [
      "Recibos e orçamentos ilimitados, com numeração própria",
      "Lançamentos manuais ilimitados",
      "Cobrança com PIX copia e cola",
      "Alerta do teto do MEI",
      "Relatório do mês em PDF e planilha",
      `Até ${LIMITES_FREE.clientes} clientes e ${LIMITES_FREE.itensPorDocumento} itens por documento`,
      `${LIMITE_NOTAS_FREE} despesas lidas por foto no mês`,
    ],
  },
  pro: {
    id: "pro",
    nome: "Pro",
    chamada: "Para quem quer parecer — e ser — profissional",
    precoMensal: 19.9,
    precoAnual: 16.9,
    limiteNotas: null,
    destaques: [
      "Seu logo e sua cor no recibo",
      "Link do recibo para mandar no WhatsApp, com PIX embutido",
      "Cliente aceita o orçamento pelo link",
      "Clientes e itens sem limite",
      "Relatório de qualquer período, não só do mês",
      `Até ${LIMITE_NOTAS_PRO} despesas lidas por foto no mês`,
      "Tudo do plano grátis",
    ],
  },
};

/**
 * Recursos que separam os planos.
 *
 * O critério: o grátis continua sendo uma ferramenta completa — nada foi
 * tirado de quem já usa. O Pro acrescenta o que o CLIENTE do MEI enxerga
 * (recibo com a marca, link para abrir no celular, aceite do orçamento) e o
 * que antecipa decisão (projeção do teto, relatório de qualquer período).
 * Recurso interno não converte; imagem perante o cliente e dinheiro que
 * entra mais rápido, sim.
 */
export const RECURSOS_PRO = [
  "marcaNoRecibo",
  "linkPublico",
  "aceiteOrcamento",
  "projecaoTeto",
  "relatorioLivre",
] as const;

export type Recurso = (typeof RECURSOS_PRO)[number];

export function temRecurso(
  perfil: PerfilPlano | null | undefined,
  recurso: Recurso
): boolean {
  // Recurso fora da lista é livre. Hoje a lista cobre tudo que é do Pro,
  // mas passar por ela deixa a liberação de um item futuro ser uma linha.
  return RECURSOS_PRO.includes(recurso) && planoEfetivo(perfil) === "pro";
}

/**
 * Colunas que decidem o plano. Use esta constante em todo `select` cujo
 * resultado vá para `planoEfetivo` e companhia.
 *
 * Existe porque o campo de teste já foi esquecido em cinco consultas: o
 * tipo o declarava opcional, o TypeScript não acusava, e o resultado era
 * uma conta em teste sendo tratada como grátis em todo lugar menos na barra
 * lateral. Agora o campo é obrigatório e o compilador cobra.
 */
export const COLUNAS_PLANO = "plano, plano_expira_em, trial_expira_em";

export type PerfilPlano = {
  plano: string | null;
  plano_expira_em: string | null;
  trial_expira_em: string | null;
  limite_notas_mes?: number | null;
};

/** Dias que faltam do teste. Zero quando não há teste ativo. */
export function diasDeTesteRestantes(
  perfil: PerfilPlano | null | undefined
): number {
  if (!perfil?.trial_expira_em) return 0;
  const restam = new Date(perfil.trial_expira_em).getTime() - Date.now();
  return restam > 0 ? Math.ceil(restam / 86_400_000) : 0;
}

/** Se o Pro vem do teste e não de assinatura paga. */
export function estaEmTeste(perfil: PerfilPlano | null | undefined): boolean {
  return diasDeTesteRestantes(perfil) > 0;
}

/**
 * Plano que de fato vale agora.
 *
 * `plano` sozinho mente depois do cancelamento: com link de pagamento
 * estático não chega evento de cancelamento, e a coluna ficaria em "pro"
 * para sempre. Espelha `plano_efetivo()` no banco.
 */
export function planoEfetivo(perfil: PerfilPlano | null | undefined): IdPlano {
  if (!perfil) return "free";

  // Campo ausente é diferente de campo nulo: nulo significa "sem teste",
  // ausente significa que a consulta esqueceu a coluna — e o resultado
  // seria rebaixar silenciosamente uma conta em teste. Como nem todo
  // retorno do Supabase é tipado, o aviso cobre o que o compilador não vê.
  if (process.env.NODE_ENV !== "production" && !("trial_expira_em" in perfil)) {
    console.error(
      "[planos] perfil sem `trial_expira_em`: use COLUNAS_PLANO no select, ou a conta em teste será tratada como grátis."
    );
  }

  // Espelha `plano_efetivo()` no banco, teste incluído.
  if (estaEmTeste(perfil)) return "pro";
  if (perfil.plano !== "pro") return "free";
  if (!perfil.plano_expira_em) return "pro";
  return new Date(perfil.plano_expira_em) > new Date() ? "pro" : "free";
}

/** Quantas notas por foto a conta pode ler no mês. */
export function limiteDeNotas(perfil: PerfilPlano | null | undefined): number {
  const explicito = perfil?.limite_notas_mes;
  if (typeof explicito === "number" && explicito > 0) return explicito;
  return planoEfetivo(perfil) === "pro" ? LIMITE_NOTAS_PRO : LIMITE_NOTAS_FREE;
}

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
