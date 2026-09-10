"use server";

import { revalidatePath } from "next/cache";
import { exigirUsuario } from "@/lib/auth";
import { hoje, lerNumeroBR } from "@/lib/formato";
import { apenasDigitos, documentoValido } from "@/lib/fiscal";
import {
  calcularTotais,
  validadeSugerida,
  type DescontoInformado,
} from "@/lib/orcamento";
import {
  type EstadoForm,
  lerOpcional,
  lerTexto,
  lerValor,
  mensagemDeLimite,
} from "@/app/actions/tipos";

function atualizarTelas() {
  revalidatePath("/orcamentos");
  revalidatePath("/cobranca");
  revalidatePath("/clientes");
}

type ItemEntrada = {
  descricao: string;
  quantidade: number;
  unidade: string;
  valorUnitario: number;
};

/**
 * Itens da proposta.
 *
 * Orçamento sem detalhamento é só um número — o cliente não sabe o que
 * está comprando e negocia no escuro. Aqui o item é a regra, não a
 * exceção como no recibo.
 */
function lerItens(formData: FormData): ItemEntrada[] {
  const descricoes = formData.getAll("item_descricao").map(String);
  const quantidades = formData.getAll("item_quantidade").map(String);
  const unidades = formData.getAll("item_unidade").map(String);
  const valores = formData.getAll("item_valor").map(String);

  return descricoes
    .map((descricao, i) => ({
      descricao: descricao.trim(),
      quantidade: lerNumeroBR(quantidades[i] ?? "1"),
      unidade: (unidades[i] ?? "un").trim() || "un",
      valorUnitario: lerNumeroBR(valores[i] ?? "0"),
    }))
    .filter((item) => item.descricao !== "" && item.quantidade > 0);
}

function totalDoItem(item: ItemEntrada): number {
  // Duas casas por item antes de somar, igual ao que o banco calcula na
  // coluna gerada — evita divergência de centavo entre tela e proposta.
  return Math.round(item.quantidade * item.valorUnitario * 100) / 100;
}

/**
 * Desconto em reais ou em percentual.
 *
 * Só um dos dois chega preenchido — o formulário manda o outro vazio, para
 * o servidor não ter que adivinhar qual vale. O percentual é guardado como
 * intenção: mudando os itens depois, o gatilho no banco recalcula o valor.
 */
function lerDesconto(formData: FormData): DescontoInformado {
  if (lerTexto(formData, "desconto_tipo") === "percentual") {
    const bruto = Number(lerTexto(formData, "desconto_percentual").replace(",", "."));
    const percentual = Number.isFinite(bruto) && bruto > 0 && bruto <= 100 ? bruto : null;
    return { percentual };
  }
  return { valor: lerValor(formData, "desconto") ?? 0 };
}

/** Campos que só existem em proposta, lidos em um lugar só. */
function lerCamposDaProposta(formData: FormData, emissao: string) {
  return {
    validade_em: lerTexto(formData, "validade_em") || validadeSugerida(emissao),
    condicoes_pagamento: lerOpcional(formData, "condicoes_pagamento"),
    prazo_execucao: lerOpcional(formData, "prazo_execucao"),
    garantia: lerOpcional(formData, "garantia"),
    observacoes: lerOpcional(formData, "observacoes"),
  };
}

export async function criarOrcamento(
  _anterior: EstadoForm,
  formData: FormData
): Promise<EstadoForm> {
  const { supabase, user } = await exigirUsuario();

  const descricao = lerTexto(formData, "descricao_servico");
  const natureza = lerTexto(formData, "natureza");

  if (!descricao) return { erro: "Diga do que é a proposta." };
  if (natureza !== "servico" && natureza !== "produto") {
    return { erro: "Escolha se é serviço ou produto." };
  }

  const itens = lerItens(formData);
  const valorSolto = lerValor(formData);

  // Com itens, eles mandam no total. Sem itens, vale o valor único — mas
  // um dos dois precisa existir, ou a proposta não tem preço.
  const subtotal =
    itens.length > 0
      ? itens.reduce((s, i) => s + totalDoItem(i), 0)
      : valorSolto ?? 0;

  const desconto = lerDesconto(formData);
  const totais = calcularTotais(
    itens.map((i) => ({
      descricao: i.descricao,
      quantidade: i.quantidade,
      unidade: i.unidade,
      valor_unitario: i.valorUnitario,
      total: totalDoItem(i),
    })),
    desconto,
    subtotal
  );

  if (totais.total === 0) {
    return { erro: "A proposta ficou sem valor. Confira os itens." };
  }

  const emissao = lerTexto(formData, "data_emissao") || hoje();

  // Cliente novo cadastrado na hora, como na venda: sair para cadastrar e
  // voltar é o que faz a proposta sair sem cliente.
  const clienteExistente = lerOpcional(formData, "cliente_id");
  let clienteId = clienteExistente;

  if (!clienteExistente) {
    const nomeNovo = lerTexto(formData, "cliente_novo_nome");
    if (nomeNovo) {
      const doc = apenasDigitos(lerTexto(formData, "cliente_novo_documento"));
      if (doc && !documentoValido(doc)) {
        return { erro: "CPF ou CNPJ do cliente é inválido. Confira os números." };
      }

      const { data: novo, error: erroCliente } = await supabase
        .from("clientes")
        .insert({
          user_id: user.id,
          nome: nomeNovo,
          documento: doc || null,
          telefone: lerOpcional(formData, "cliente_novo_telefone"),
        })
        .select("id")
        .single();

      if (erroCliente) {
        if (erroCliente.code === "23505") {
          return {
            erro: "Já existe um cliente com esse CPF/CNPJ. Escolha ele na lista.",
          };
        }
        return {
          erro:
            mensagemDeLimite(erroCliente.message) ??
            "Não foi possível cadastrar o cliente.",
        };
      }
      clienteId = novo.id;
    }
  }

  const { data: documento, error } = await supabase
    .from("documentos_venda")
    .insert({
      user_id: user.id,
      tipo: "orcamento",
      natureza,
      descricao_servico: descricao,
      valor: totais.total,
      desconto: totais.desconto,
      desconto_percentual: desconto.percentual ?? null,
      // Proposta nunca nasce paga: não há dinheiro nenhum ainda.
      status: "pendente",
      cliente_id: clienteId,
      data_emissao: emissao,
      ...lerCamposDaProposta(formData, emissao),
    })
    .select("id, numero")
    .single();

  if (error) return { erro: "Não foi possível criar o orçamento." };

  if (itens.length > 0) {
    const { error: erroItens } = await supabase.from("itens_documento").insert(
      itens.map((item, i) => ({
        user_id: user.id,
        documento_venda_id: documento.id,
        descricao: item.descricao,
        quantidade: item.quantidade,
        unidade: item.unidade,
        valor_unitario: item.valorUnitario,
        ordem: i + 1,
      }))
    );

    if (erroItens) {
      return {
        erro:
          mensagemDeLimite(erroItens.message) ??
          `Orçamento #${documento.numero} criado, mas os itens não salvaram. Corrija na proposta.`,
      };
    }
  }

  atualizarTelas();
  return { sucesso: `Orçamento #${documento.numero} criado.` };
}

/**
 * Corrige a proposta enquanto ela ainda é proposta.
 *
 * Depois de aceita, mexer no preço muda o que o cliente concordou em
 * pagar — o caminho aí é cancelar e propor de novo, que deixa rastro.
 */
export async function editarOrcamento(
  _anterior: EstadoForm,
  formData: FormData
): Promise<EstadoForm> {
  const { supabase, user } = await exigirUsuario();

  const id = lerTexto(formData, "id");
  if (!id) return { erro: "Orçamento não identificado." };

  const { data: atual } = await supabase
    .from("documentos_venda")
    .select("id, tipo, status, aceito_em, data_emissao")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!atual) return { erro: "Orçamento não encontrado." };
  if (atual.tipo !== "orcamento") return { erro: "Este documento não é um orçamento." };
  if (atual.aceito_em) {
    return {
      erro: "O cliente já aceitou esta proposta. Para mudar o preço, cancele e faça outra.",
    };
  }
  if (atual.status !== "pendente") {
    return { erro: "Só dá para corrigir proposta que ainda está aberta." };
  }

  const descricao = lerTexto(formData, "descricao_servico");
  if (!descricao) return { erro: "Diga do que é a proposta." };

  const itens = lerItens(formData);
  const valorSolto = lerValor(formData);
  const desconto = lerDesconto(formData);

  const linhas = itens.map((i) => ({
    descricao: i.descricao,
    quantidade: i.quantidade,
    unidade: i.unidade,
    valor_unitario: i.valorUnitario,
    total: totalDoItem(i),
  }));

  const totais = calcularTotais(linhas, desconto, valorSolto ?? 0);
  if (totais.total === 0) {
    return { erro: "A proposta ficou sem valor. Confira os itens." };
  }

  const { error } = await supabase
    .from("documentos_venda")
    .update({
      descricao_servico: descricao,
      natureza: lerTexto(formData, "natureza") || undefined,
      valor: totais.total,
      desconto: totais.desconto,
      desconto_percentual: desconto.percentual ?? null,
      cliente_id: lerOpcional(formData, "cliente_id"),
      ...lerCamposDaProposta(formData, atual.data_emissao),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { erro: "Não foi possível salvar." };

  // Substituídos por inteiro: reconciliar linha a linha traria mais
  // chance de erro do que valor.
  await supabase.from("itens_documento").delete().eq("documento_venda_id", id);

  if (itens.length > 0) {
    await supabase.from("itens_documento").insert(
      itens.map((item, i) => ({
        user_id: user.id,
        documento_venda_id: id,
        descricao: item.descricao,
        quantidade: item.quantidade,
        unidade: item.unidade,
        valor_unitario: item.valorUnitario,
        ordem: i + 1,
      }))
    );
  }

  atualizarTelas();
  revalidatePath(`/orcamentos/${id}`);
  return { sucesso: "Proposta atualizada." };
}
