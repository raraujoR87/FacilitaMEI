"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { EstadoForm } from "@/app/actions/tipos";

/**
 * Aceite do orçamento pelo cliente, sem conta e sem login.
 *
 * A única credencial é o token do link, que é um UUID aleatório. Não usa
 * `exigirUsuario` de propósito: quem aceita é o cliente do MEI, que não tem
 * — e não deveria precisar ter — cadastro aqui.
 */
export async function aceitarOrcamento(
  _anterior: EstadoForm,
  formData: FormData
): Promise<EstadoForm> {
  const token = String(formData.get("token") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();

  if (!nome) return { erro: "Escreva seu nome para aceitar." };
  if (nome.length < 3) return { erro: "Escreva seu nome completo." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("aceitar_orcamento", { token, nome });

  if (error) return { erro: "Não foi possível registrar o aceite." };
  if (data === false) {
    return { erro: "Este orçamento já foi aceito ou não está mais disponível." };
  }

  revalidatePath(`/r/${token}`);
  return { sucesso: "Aceite registrado. Já avisamos quem enviou o orçamento." };
}
