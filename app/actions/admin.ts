"use server";

import { revalidatePath } from "next/cache";
import { exigirAdministrador } from "@/lib/admin";
import { type EstadoForm, lerTexto } from "@/app/actions/tipos";

/**
 * Dispara o e-mail de redefinição de senha para o cliente.
 *
 * O operador nunca define nem enxerga a senha de ninguém: o link vai para o
 * e-mail do próprio dono da conta, e só ele consegue concluir a troca. É a
 * diferença entre destravar um cliente e conseguir se passar por ele.
 */
export async function enviarResetDeSenha(
  _anterior: EstadoForm,
  formData: FormData
): Promise<EstadoForm> {
  const { supabase } = await exigirAdministrador();

  const email = lerTexto(formData, "email");
  if (!email) return { erro: "Conta sem e-mail cadastrado." };

  const origem = lerTexto(formData, "origem");
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: origem ? `${origem}/login` : undefined,
  });

  if (error) {
    return { erro: `Não foi possível enviar: ${error.message}` };
  }

  return { sucesso: `Link de redefinição enviado para ${email}.` };
}

/** Reenvia o e-mail de confirmação de quem travou no cadastro. */
export async function reenviarConfirmacao(
  _anterior: EstadoForm,
  formData: FormData
): Promise<EstadoForm> {
  const { supabase } = await exigirAdministrador();

  const email = lerTexto(formData, "email");
  if (!email) return { erro: "Conta sem e-mail cadastrado." };

  const { error } = await supabase.auth.resend({ type: "signup", email });

  if (error) {
    return { erro: `Não foi possível reenviar: ${error.message}` };
  }

  revalidatePath("/admin/problemas");
  return { sucesso: `Confirmação reenviada para ${email}.` };
}

/** Muda o plano do cliente e o limite de notas lidas por IA no mês. */
export async function definirPlano(
  _anterior: EstadoForm,
  formData: FormData
): Promise<EstadoForm> {
  const { supabase } = await exigirAdministrador();

  const alvo = lerTexto(formData, "user_id");
  const plano = lerTexto(formData, "plano");
  const limite = Number(lerTexto(formData, "limite_notas_mes"));

  if (!alvo) return { erro: "Conta não identificada." };
  if (plano !== "free" && plano !== "pro") return { erro: "Plano inválido." };
  if (!Number.isInteger(limite) || limite < 0) {
    return { erro: "Limite de notas inválido." };
  }

  // A função do banco refaz a checagem de administrador e só toca em plano e
  // limite — chave PIX e telefone do cliente ficam fora do alcance.
  const { error } = await supabase.rpc("admin_definir_plano", {
    alvo,
    novo_plano: plano,
    novo_limite: limite,
  });

  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidatePath("/admin");
  return { sucesso: `Plano atualizado para ${plano}.` };
}
