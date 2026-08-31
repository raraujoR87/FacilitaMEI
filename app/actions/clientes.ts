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

function atualizarTelas() {
  revalidatePath("/clientes");
  revalidatePath("/movimento");
  revalidatePath("/cobranca");
}

/**
 * Campos comuns a cadastro e edição.
 *
 * O documento decide se a venda para esse cliente exige nota fiscal;
 * errado, o aviso fiscal fica errado junto. Melhor recusar na entrada.
 */
function lerCampos(formData: FormData):
  | { erro: string }
  | {
      nome: string;
      documento: string | null;
      telefone: string | null;
      email: string | null;
      observacoes: string | null;
    } {
  const nome = lerTexto(formData, "nome");
  if (!nome) return { erro: "O nome do cliente é obrigatório." };

  const documento = apenasDigitos(lerTexto(formData, "documento"));
  if (documento && !documentoValido(documento)) {
    return { erro: "CPF ou CNPJ inválido. Confira os números." };
  }

  return {
    nome,
    documento: documento || null,
    telefone: lerOpcional(formData, "telefone"),
    email: lerOpcional(formData, "email"),
    observacoes: lerOpcional(formData, "observacoes"),
  };
}

/** Cadastro duplicado divide a dívida e o histórico em dois nomes. */
function mensagemDeErro(codigo: string | undefined, mensagem: string): string {
  if (codigo === "23505") {
    return "Já existe um cliente com esse CPF/CNPJ. Procure na lista — pode ser a mesma pessoa.";
  }
  return mensagemDeLimite(mensagem) ?? "Não foi possível salvar o cliente.";
}

export async function criarCliente(
  _anterior: EstadoForm,
  formData: FormData
): Promise<EstadoForm> {
  const { supabase, user } = await exigirUsuario();

  const campos = lerCampos(formData);
  if ("erro" in campos) return campos;

  const { error } = await supabase
    .from("clientes")
    .insert({ user_id: user.id, ...campos });

  if (error) return { erro: mensagemDeErro(error.code, error.message) };

  atualizarTelas();
  return { sucesso: `${campos.nome} cadastrado.` };
}

/**
 * Corrige o cadastro.
 *
 * Faltava, e doía em dois lugares: nome errado ia para todo recibo já
 * emitido, e não havia como acrescentar o CPF/CNPJ depois — que é o campo
 * que decide se a venda exige nota. Cadastrar sem ele deixava o aviso
 * fiscal errado para sempre.
 */
export async function editarCliente(
  _anterior: EstadoForm,
  formData: FormData
): Promise<EstadoForm> {
  const { supabase, user } = await exigirUsuario();

  const id = lerTexto(formData, "id");
  if (!id) return { erro: "Cliente não identificado." };

  const campos = lerCampos(formData);
  if ("erro" in campos) return campos;

  const { error } = await supabase
    .from("clientes")
    .update(campos)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { erro: mensagemDeErro(error.code, error.message) };

  atualizarTelas();
  return { sucesso: "Cadastro atualizado." };
}

/**
 * Tira o cliente da lista sem apagar o histórico.
 *
 * Existe porque excluir só era possível para quem nunca comprou, e o
 * grátis conta 5 clientes: quem chegasse a 5 clientes com histórico não
 * podia excluir nem cadastrar mais ninguém — beco sem saída. Arquivado sai
 * da lista e da contagem do plano; os recibos continuam com o nome.
 */
export async function arquivarCliente(
  _anterior: EstadoForm,
  formData: FormData
): Promise<EstadoForm> {
  const { supabase, user } = await exigirUsuario();
  const id = lerTexto(formData, "id");
  if (!id) return { erro: "Cliente não identificado." };

  // Arquivar quem deve esconderia a dívida da carteira. A cobrança
  // continua em "A receber", mas o cliente sumiria da lista de quem
  // precisa de atenção — e é essa lista que faz o dinheiro voltar.
  const { data: aberto } = await supabase
    .from("documentos_venda")
    .select("id")
    .eq("cliente_id", id)
    .eq("user_id", user.id)
    .eq("tipo", "recibo")
    .eq("status", "pendente")
    .limit(1);

  if (aberto && aberto.length > 0) {
    return {
      erro: "Este cliente ainda tem cobrança em aberto. Receba ou cancele antes de arquivar.",
    };
  }

  const { error } = await supabase
    .from("clientes")
    .update({ arquivado_em: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { erro: "Não foi possível arquivar." };

  atualizarTelas();
  return { sucesso: "Cliente arquivado." };
}

export async function reativarCliente(
  _anterior: EstadoForm,
  formData: FormData
): Promise<EstadoForm> {
  const { supabase, user } = await exigirUsuario();
  const id = lerTexto(formData, "id");
  if (!id) return { erro: "Cliente não identificado." };

  const { error } = await supabase
    .from("clientes")
    .update({ arquivado_em: null })
    .eq("id", id)
    .eq("user_id", user.id);

  // Reativar ocupa vaga de novo: no grátis, o gatilho do banco recusa
  // quando as cinco já estão preenchidas.
  if (error) {
    return {
      erro:
        mensagemDeLimite(error.message) ?? "Não foi possível reativar o cliente.",
    };
  }

  atualizarTelas();
  return { sucesso: "Cliente reativado." };
}

/**
 * Exclusão definitiva, só para quem nunca comprou.
 *
 * Quem tem recibo emitido é arquivado, nunca apagado: a FK é
 * `on delete set null` e o documento ficaria sem nome. O banco recusa por
 * gatilho — esconder o botão na tela não é controle de acesso.
 */
export async function excluirCliente(formData: FormData): Promise<void> {
  const { supabase, user } = await exigirUsuario();
  const id = lerTexto(formData, "id");
  if (!id) return;

  await supabase.from("clientes").delete().eq("id", id).eq("user_id", user.id);

  atualizarTelas();
}
