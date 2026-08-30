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

export async function criarDocumento(
  _anterior: EstadoForm,
  formData: FormData
): Promise<EstadoForm> {
  const { supabase, user } = await exigirUsuario();

  const descricao = lerTexto(formData, "descricao_servico");
  const valor = lerValor(formData);
  const tipo = lerTexto(formData, "tipo");

  if (!descricao) return { erro: "Descreva o serviço ou produto." };
  if (valor === null || valor === 0) return { erro: "Informe um valor válido." };
  if (tipo !== "recibo" && tipo !== "orcamento") {
    return { erro: "Escolha entre recibo e orçamento." };
  }

  const { data, error } = await supabase
    .from("documentos_venda")
    .insert({
      user_id: user.id,
      tipo,
      descricao_servico: descricao,
      valor,
      cliente_id: lerOpcional(formData, "cliente_id"),
      data_emissao: lerTexto(formData, "data_emissao") || hoje(),
      data_vencimento: lerOpcional(formData, "data_vencimento"),
    })
    .select("numero")
    .single();

  if (error) return { erro: "Não foi possível emitir o documento." };

  revalidatePath("/vendas");
  revalidatePath("/cobranca");
  return {
    sucesso: `${tipo === "recibo" ? "Recibo" : "Orçamento"} #${data.numero} emitido.`,
  };
}

/**
 * Baixa de uma cobrança. Além de mudar o status, gera a receita
 * correspondente no financeiro — do contrário o dinheiro recebido não
 * apareceria no relatório do contador.
 */
export async function marcarComoPago(formData: FormData): Promise<void> {
  const { supabase, user } = await exigirUsuario();
  const id = lerTexto(formData, "id");
  if (!id) return;

  const { data: documento } = await supabase
    .from("documentos_venda")
    .select("id, valor, descricao_servico, numero, status, clientes(nome)")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!documento || documento.status === "pago") return;

  await supabase
    .from("documentos_venda")
    .update({ status: "pago" })
    .eq("id", id)
    .eq("user_id", user.id);

  const { data: categoria } = await supabase
    .from("categorias")
    .select("id")
    .eq("user_id", user.id)
    .eq("nome", "Vendas")
    .maybeSingle();

  const cliente = Array.isArray(documento.clientes)
    ? documento.clientes[0]
    : documento.clientes;

  // O índice único em documento_venda_id transforma um clique duplo em
  // violação de unicidade em vez de receita duplicada; por isso o erro
  // aqui é esperado e ignorado.
  await supabase.from("lancamentos").insert({
    user_id: user.id,
    documento_venda_id: documento.id,
    categoria_id: categoria?.id ?? null,
    tipo: "receita",
    descricao: `Recibo #${documento.numero} — ${documento.descricao_servico}`,
    valor: documento.valor,
    data_competencia: hoje(),
    fornecedor_cliente: cliente?.nome ?? null,
    origem: "manual",
    pago: true,
  });

  revalidatePath("/cobranca");
  revalidatePath("/vendas");
  revalidatePath("/financeiro");
  revalidatePath("/dashboard");
}

export async function cancelarDocumento(formData: FormData): Promise<void> {
  const { supabase, user } = await exigirUsuario();
  const id = lerTexto(formData, "id");
  if (!id) return;

  await supabase
    .from("documentos_venda")
    .update({ status: "cancelado" })
    .eq("id", id)
    .eq("user_id", user.id);

  revalidatePath("/cobranca");
  revalidatePath("/vendas");
}
