"use server";

import { revalidatePath } from "next/cache";
import { exigirUsuario } from "@/lib/auth";
import { hoje } from "@/lib/formato";
import {
  type EstadoForm,
  lerOpcional,
  lerTexto,
  lerValor,
  mensagemDeLimite,
} from "@/app/actions/tipos";

function atualizarTelas() {
  revalidatePath("/movimento");
  revalidatePath("/dashboard");
  revalidatePath("/relatorio");
}

export async function criarDespesaFixa(
  _anterior: EstadoForm,
  formData: FormData
): Promise<EstadoForm> {
  const { supabase, user } = await exigirUsuario();

  const descricao = lerTexto(formData, "descricao");
  const valor = lerValor(formData);

  if (!descricao) return { erro: "Diga que conta é essa." };
  if (valor === null || valor === 0) return { erro: "Informe um valor válido." };

  const diaBruto = lerTexto(formData, "dia_vencimento");
  const dia = diaBruto ? Number(diaBruto) : null;
  if (dia !== null && (!Number.isInteger(dia) || dia < 1 || dia > 31)) {
    return { erro: "O dia do vencimento vai de 1 a 31." };
  }

  const { error } = await supabase.from("despesas_fixas").insert({
    user_id: user.id,
    descricao,
    valor,
    dia_vencimento: dia,
    categoria_id: lerOpcional(formData, "categoria_id"),
  });

  if (error) {
    return { erro: mensagemDeLimite(error.message) ?? "Não foi possível salvar." };
  }

  atualizarTelas();
  return { sucesso: "Conta fixa cadastrada." };
}

/**
 * Some com a conta sem apagar o histórico.
 *
 * Excluir de verdade zeraria o vínculo dos lançamentos já feitos (a FK é
 * `set null`) e o mês passado perderia a explicação de para onde o
 * dinheiro foi. Desativar mantém o passado intacto.
 */
export async function desativarDespesaFixa(formData: FormData): Promise<void> {
  const { supabase, user } = await exigirUsuario();
  const id = lerTexto(formData, "id");
  if (!id) return;

  await supabase
    .from("despesas_fixas")
    .update({ ativa: false })
    .eq("id", id)
    .eq("user_id", user.id);

  atualizarTelas();
}

/**
 * Lança a conta fixa do mês.
 *
 * O valor vem do formulário, não do cadastro: luz e água mudam todo mês, e
 * repetir o previsto faria o extrato do app divergir do banco. O cadastro
 * serve de sugestão.
 */
export async function lancarDespesaFixa(
  _anterior: EstadoForm,
  formData: FormData
): Promise<EstadoForm> {
  const { supabase, user } = await exigirUsuario();

  const id = lerTexto(formData, "id");
  if (!id) return { erro: "Conta não identificada." };

  const valor = lerValor(formData);
  if (valor === null || valor === 0) return { erro: "Informe um valor válido." };

  const { data: fixa } = await supabase
    .from("despesas_fixas")
    .select("descricao, categoria_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!fixa) return { erro: "Conta fixa não encontrada." };

  const { error } = await supabase.from("lancamentos").insert({
    user_id: user.id,
    tipo: "despesa",
    // Conta fixa é sempre custo do negócio — aluguel e internet não são
    // retirada nem imposto.
    natureza_saida: "custo",
    descricao: fixa.descricao,
    valor,
    data_competencia: lerTexto(formData, "data_competencia") || hoje(),
    categoria_id: fixa.categoria_id,
    origem: "manual",
    despesa_fixa_id: id,
  });

  if (error) {
    // O índice único do banco recusa o segundo lançamento do mesmo mês —
    // dois cliques ou um voltar de tela não podem dobrar o aluguel.
    if (error.code === "23505") {
      return { erro: "Esta conta já foi lançada neste mês." };
    }
    return { erro: "Não foi possível lançar." };
  }

  atualizarTelas();
  return { sucesso: `${fixa.descricao} lançada.` };
}
