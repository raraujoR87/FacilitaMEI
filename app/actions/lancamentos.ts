"use server";

import { revalidatePath } from "next/cache";
import { exigirUsuario } from "@/lib/auth";
import { hoje } from "@/lib/formato";
import {
  type EstadoForm,
  lerOpcional,
  lerTexto,
  lerValor,
} from "@/app/actions/tipos";

/**
 * Registra uma saída de dinheiro.
 *
 * Só despesa passa por aqui. Entrada tem caminho próprio, em
 * `criarDocumento`, porque toda entrada precisa gerar recibo — deixar as
 * duas no mesmo formulário era o que permitia registrar receita sem
 * documento nenhum.
 */
export async function criarLancamento(
  _anterior: EstadoForm,
  formData: FormData
): Promise<EstadoForm> {
  const { supabase, user } = await exigirUsuario();

  const descricao = lerTexto(formData, "descricao");
  const valor = lerValor(formData);

  if (!descricao) return { erro: "Descreva a saída." };
  if (valor === null) return { erro: "Informe um valor válido." };
  if (valor === 0) return { erro: "O valor precisa ser maior que zero." };

  const { error } = await supabase.from("lancamentos").insert({
    user_id: user.id,
    tipo: "despesa",
    descricao,
    valor,
    data_competencia: lerTexto(formData, "data_competencia") || hoje(),
    categoria_id: lerOpcional(formData, "categoria_id"),
    fornecedor_cliente: lerOpcional(formData, "fornecedor_cliente"),
    origem: "manual",
    pago: formData.get("pago") !== "nao",
  });

  if (error) return { erro: "Não foi possível salvar. Tente de novo." };

  revalidatePath("/movimento");
  revalidatePath("/dashboard");
  revalidatePath("/relatorio");
  return { sucesso: "Saída lançada." };
}

export async function excluirLancamento(formData: FormData): Promise<void> {
  const { supabase, user } = await exigirUsuario();
  const id = lerTexto(formData, "id");
  if (!id) return;

  // O filtro por user_id é redundante com a RLS, mas mantém a intenção
  // explícita no código — quem lê a query vê o escopo sem precisar
  // conhecer as policies do banco.
  await supabase.from("lancamentos").delete().eq("id", id).eq("user_id", user.id);

  revalidatePath("/movimento");
  revalidatePath("/dashboard");
  revalidatePath("/relatorio");
}
