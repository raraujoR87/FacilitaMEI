"use server";

import { revalidatePath } from "next/cache";
import { exigirUsuario } from "@/lib/auth";
import { type EstadoForm, lerOpcional } from "@/app/actions/tipos";

/**
 * Gera o link do contador.
 *
 * Gerar de novo revoga o anterior — o índice único no banco garante um só
 * ativo por conta. Vários links vivos multiplicam a superfície e ninguém
 * lembra de revogar os antigos.
 */
export async function gerarAcessoContador(
  _anterior: EstadoForm,
  formData: FormData
): Promise<EstadoForm> {
  const { supabase, user } = await exigirUsuario();

  await supabase
    .from("acessos_contador")
    .update({ revogado_em: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("revogado_em", null);

  const { error } = await supabase.from("acessos_contador").insert({
    user_id: user.id,
    nome_contador: lerOpcional(formData, "nome_contador"),
  });

  if (error) return { erro: "Não foi possível gerar o link. Tente de novo." };

  revalidatePath("/relatorio");
  return { sucesso: "Link gerado." };
}

/**
 * Corta o acesso na hora.
 *
 * Trocar de contador é o caso comum, e o antigo não pode continuar
 * enxergando o faturamento.
 */
export async function revogarAcessoContador(): Promise<void> {
  const { supabase, user } = await exigirUsuario();

  await supabase
    .from("acessos_contador")
    .update({ revogado_em: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("revogado_em", null);

  revalidatePath("/relatorio");
}
