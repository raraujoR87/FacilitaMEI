"use server";

import { revalidatePath } from "next/cache";
import { exigirUsuario } from "@/lib/auth";
import { type EstadoForm, lerOpcional, lerTexto } from "@/app/actions/tipos";

export async function criarCliente(
  _anterior: EstadoForm,
  formData: FormData
): Promise<EstadoForm> {
  const { supabase, user } = await exigirUsuario();

  const nome = lerTexto(formData, "nome");
  if (!nome) return { erro: "O nome do cliente é obrigatório." };

  const { error } = await supabase.from("clientes").insert({
    user_id: user.id,
    nome,
    telefone: lerOpcional(formData, "telefone"),
    email: lerOpcional(formData, "email"),
    observacoes: lerOpcional(formData, "observacoes"),
  });

  if (error) return { erro: "Não foi possível salvar o cliente." };

  revalidatePath("/clientes");
  revalidatePath("/vendas");
  return { sucesso: `${nome} cadastrado.` };
}

export async function excluirCliente(formData: FormData): Promise<void> {
  const { supabase, user } = await exigirUsuario();
  const id = lerTexto(formData, "id");
  if (!id) return;

  await supabase.from("clientes").delete().eq("id", id).eq("user_id", user.id);

  revalidatePath("/clientes");
  revalidatePath("/vendas");
}
