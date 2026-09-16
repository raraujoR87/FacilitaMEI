"use server";

import { revalidatePath } from "next/cache";
import { exigirUsuario } from "@/lib/auth";
import {
  type EstadoForm,
  lerOpcional,
  lerTexto,
  lerValor,
  mensagemDeLimite,
} from "@/app/actions/tipos";

function atualizarTelas() {
  revalidatePath("/catalogo");
  revalidatePath("/movimento");
  revalidatePath("/orcamentos");
}

/** Nome duplicado divide o histórico do mesmo item em dois registros. */
function mensagemDeErro(codigo: string | undefined, mensagem: string): string {
  if (codigo === "23505") {
    return "Já existe um item com esse nome no catálogo.";
  }
  return mensagemDeLimite(mensagem) ?? "Não foi possível salvar o item.";
}

function lerCampos(formData: FormData):
  | { erro: string }
  | {
      nome: string;
      natureza: "servico" | "produto";
      preco: number;
      custo: number;
      unidade: string;
    } {
  const nome = lerTexto(formData, "nome");
  if (!nome) return { erro: "Diga o nome do item." };

  const natureza = lerTexto(formData, "natureza");
  if (natureza !== "servico" && natureza !== "produto") {
    return { erro: "Escolha se é serviço ou produto." };
  }

  const preco = lerValor(formData, "preco");
  if (preco === null || preco === 0) {
    return { erro: "Informe quanto você cobra por este item." };
  }

  // Custo é opcional: quem não sabe o custo ainda tem o preço poupado de
  // digitação, que já é o ganho principal.
  const custo = lerValor(formData, "custo") ?? 0;

  return {
    nome,
    natureza,
    preco,
    custo,
    unidade: lerOpcional(formData, "unidade") ?? "un",
  };
}

export async function criarItemCatalogo(
  _anterior: EstadoForm,
  formData: FormData
): Promise<EstadoForm> {
  const { supabase, user } = await exigirUsuario();

  const campos = lerCampos(formData);
  if ("erro" in campos) return campos;

  const { error } = await supabase
    .from("itens_catalogo")
    .insert({ user_id: user.id, ...campos });

  if (error) return { erro: mensagemDeErro(error.code, error.message) };

  atualizarTelas();
  return { sucesso: `${campos.nome} adicionado ao catálogo.` };
}

export async function editarItemCatalogo(
  _anterior: EstadoForm,
  formData: FormData
): Promise<EstadoForm> {
  const { supabase, user } = await exigirUsuario();

  const id = lerTexto(formData, "id");
  if (!id) return { erro: "Item não identificado." };

  const campos = lerCampos(formData);
  if ("erro" in campos) return campos;

  const { error } = await supabase
    .from("itens_catalogo")
    .update(campos)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { erro: mensagemDeErro(error.code, error.message) };

  // Documentos já emitidos não mudam: eles guardam preço e custo
  // fotografados na emissão, de propósito.
  atualizarTelas();
  return { sucesso: "Item atualizado. Documentos já emitidos não mudam." };
}

/**
 * Tira o item de circulação sem apagar o histórico.
 *
 * Excluir de verdade zeraria o vínculo nos documentos que já o usaram (a
 * chave estrangeira é `set null`) e o relatório perderia a origem do
 * número.
 */
export async function arquivarItemCatalogo(formData: FormData): Promise<void> {
  const { supabase, user } = await exigirUsuario();
  const id = lerTexto(formData, "id");
  if (!id) return;

  await supabase
    .from("itens_catalogo")
    .update({ arquivado_em: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  atualizarTelas();
}

export async function reativarItemCatalogo(
  _anterior: EstadoForm,
  formData: FormData
): Promise<EstadoForm> {
  const { supabase, user } = await exigirUsuario();
  const id = lerTexto(formData, "id");
  if (!id) return { erro: "Item não identificado." };

  const { error } = await supabase
    .from("itens_catalogo")
    .update({ arquivado_em: null })
    .eq("id", id)
    .eq("user_id", user.id);

  // Reativar ocupa vaga de novo: no grátis o gatilho recusa quando as
  // quinze já estão preenchidas.
  if (error) {
    return {
      erro: mensagemDeLimite(error.message) ?? "Não foi possível reativar o item.",
    };
  }

  atualizarTelas();
  return { sucesso: "Item reativado." };
}
