"use server";

import { revalidatePath } from "next/cache";
import { exigirUsuario } from "@/lib/auth";
import {
  type EstadoForm,
  lerOpcional,
  lerTexto,
  mensagemDeLimite,
} from "@/app/actions/tipos";
import { apenasDigitos, documentoValido } from "@/lib/fiscal";

export async function criarCliente(
  _anterior: EstadoForm,
  formData: FormData
): Promise<EstadoForm> {
  const { supabase, user } = await exigirUsuario();

  const nome = lerTexto(formData, "nome");
  if (!nome) return { erro: "O nome do cliente é obrigatório." };

  // O documento decide se a venda para esse cliente exige nota fiscal;
  // errado, o aviso fiscal fica errado junto. Melhor recusar na entrada.
  const documento = apenasDigitos(lerTexto(formData, "documento"));
  if (documento && !documentoValido(documento)) {
    return { erro: "CPF ou CNPJ inválido. Confira os números." };
  }

  const { error } = await supabase.from("clientes").insert({
    user_id: user.id,
    nome,
    documento: documento || null,
    telefone: lerOpcional(formData, "telefone"),
    email: lerOpcional(formData, "email"),
    observacoes: lerOpcional(formData, "observacoes"),
  });

  if (error) {
    return { erro: mensagemDeLimite(error.message) ?? "Não foi possível salvar o cliente." };
  }

  revalidatePath("/clientes");
  revalidatePath("/movimento");
  return { sucesso: `${nome} cadastrado.` };
}

export async function excluirCliente(formData: FormData): Promise<void> {
  const { supabase, user } = await exigirUsuario();
  const id = lerTexto(formData, "id");
  if (!id) return;

  await supabase.from("clientes").delete().eq("id", id).eq("user_id", user.id);

  revalidatePath("/clientes");
  revalidatePath("/movimento");
}
