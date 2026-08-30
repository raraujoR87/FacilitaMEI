import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Tenant = {
  user_id: string;
  email: string | null;
  nome_negocio: string;
  plano: "free" | "pro";
  plano_expira_em: string | null;
  trial_expira_em: string | null;
  plano_efetivo: "free" | "pro";
  limite_notas_mes: number;
  criado_em: string;
  ultimo_acesso: string | null;
  email_confirmado: boolean;
  bloqueado: boolean;
  tem_pix: boolean;
  tem_whatsapp: boolean;
  total_lancamentos: number;
  total_documentos: number;
  total_clientes: number;
  total_comprovantes: number;
  bytes_comprovantes: number;
  ultimo_lancamento: string | null;
  notas_ia_no_mes: number;
  faturamento_ano: number;
};

export type EventoAuth = {
  ocorrido_em: string;
  acao: string | null;
  ator_email: string | null;
  ator_id: string | null;
  ip: string | null;
  /** "auditoria" veio do GoTrue; "derivado" foi reconstruído de auth.users. */
  origem: "auditoria" | "derivado";
};

export type ContaComProblema = {
  user_id: string;
  email: string | null;
  criado_em: string;
  problema:
    | "email_nao_confirmado"
    | "sem_perfil"
    | "nunca_acessou"
    | "bloqueado";
  detalhe: string;
};

/**
 * Guarda das telas de administração.
 *
 * A checagem aqui evita renderizar o back-office para quem não deve vê-lo,
 * mas não é a defesa principal: cada função do banco refaz a verificação por
 * conta própria. Mesmo que esta linha saísse do código, um cliente comum
 * chamando o endpoint RPC continuaria recebendo "acesso restrito".
 */
export async function exigirAdministrador() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: ehAdmin } = await supabase.rpc("eh_administrador");

  if (!ehAdmin) redirect("/dashboard");

  return { supabase, user };
}

/** Bytes → "1,4 MB", para caber na tabela. */
export function formatarTamanho(bytes: number): string {
  if (!bytes) return "—";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Datas com hora, para logs. */
export function formatarMomento(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
}

/** "há 3 dias" comunica melhor que uma data absoluta em coluna de atividade. */
export function tempoDesde(iso: string | null): string {
  if (!iso) return "nunca";

  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 30) return `há ${dias} dias`;
  if (dias < 365) return `há ${Math.floor(dias / 30)} meses`;
  return `há ${Math.floor(dias / 365)} ano(s)`;
}
