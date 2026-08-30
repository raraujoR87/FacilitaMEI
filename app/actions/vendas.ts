"use server";

import { revalidatePath } from "next/cache";
import { exigirUsuario } from "@/lib/auth";
import { hoje, lerNumeroBR } from "@/lib/formato";
import {
  type EstadoForm,
  lerOpcional,
  lerTexto,
  lerValor,
} from "@/app/actions/tipos";

type ItemEntrada = {
  descricao: string;
  quantidade: number;
  unidade: string;
  valorUnitario: number;
};

/**
 * Lê as linhas de detalhamento do formulário.
 *
 * Os campos chegam como listas paralelas (uma entrada por linha da tabela).
 * Linhas sem descrição são descartadas: é o que sobra quando a pessoa
 * adiciona uma linha e desiste de preencher.
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

function somarItens(itens: ItemEntrada[]): number {
  // Duas casas por item antes de somar, igual ao que o banco calcula na
  // coluna gerada — evita divergência de centavo entre tela e recibo.
  return itens.reduce(
    (soma, item) => soma + Math.round(item.quantidade * item.valorUnitario * 100) / 100,
    0
  );
}

/** Telas afetadas por qualquer mudança em entrada de dinheiro. */
const TELAS_DE_ENTRADA = ["/movimento", "/cobranca", "/dashboard", "/relatorio"];

function revalidarEntradas() {
  for (const tela of TELAS_DE_ENTRADA) revalidatePath(tela);
}

/**
 * Registra uma entrada de dinheiro.
 *
 * É o único caminho para receita entrar no sistema: sempre gera um
 * documento numerado. Antes havia dois caminhos — lançamento de receita no
 * financeiro ou recibo em vendas — e quem escolhia o primeiro ficava sem
 * recibo para dar ao cliente.
 */
export async function criarDocumento(
  _anterior: EstadoForm,
  formData: FormData
): Promise<EstadoForm> {
  const { supabase, user } = await exigirUsuario();

  const descricao = lerTexto(formData, "descricao_servico");
  const valor = lerValor(formData);
  const tipo = lerTexto(formData, "tipo");
  const natureza = lerTexto(formData, "natureza");
  // Recebido na hora é o caso comum no balcão; a pendência é a exceção.
  const recebido = formData.get("recebido") === "sim";

  if (!descricao) return { erro: "Descreva o serviço ou produto." };
  if (valor === null) return { erro: "Informe um valor válido." };
  if (tipo !== "recibo" && tipo !== "orcamento") {
    return { erro: "Escolha entre recibo e orçamento." };
  }
  if (natureza !== "servico" && natureza !== "produto") {
    return { erro: "Escolha se foi serviço prestado ou produto vendido." };
  }

  const itens = lerItens(formData);
  // Havendo itens, eles mandam no total: o valor solto viraria uma segunda
  // verdade, e o PIX poderia cobrar diferente do que o recibo mostra.
  const valorTotal = itens.length > 0 ? somarItens(itens) : valor;

  if (valorTotal === 0) {
    return { erro: "O total ficou zerado. Confira os valores dos itens." };
  }

  // Orçamento é proposta, não dinheiro recebido: nunca entra como pago.
  const status = tipo === "recibo" && recebido ? "pago" : "pendente";

  const { data: documento, error } = await supabase
    .from("documentos_venda")
    .insert({
      user_id: user.id,
      tipo,
      natureza,
      descricao_servico: descricao,
      valor: valorTotal,
      status,
      cliente_id: lerOpcional(formData, "cliente_id"),
      data_emissao: lerTexto(formData, "data_emissao") || hoje(),
      data_vencimento: lerOpcional(formData, "data_vencimento"),
      observacoes: lerOpcional(formData, "observacoes"),
    })
    .select("id, numero")
    .single();

  if (error) return { erro: "Não foi possível emitir o documento." };

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
      // Documento sem os itens que o justificam é pior que documento
      // nenhum: o cliente receberia um recibo sem o detalhe combinado.
      await supabase.from("documentos_venda").delete().eq("id", documento.id);
      return { erro: "Não foi possível salvar os itens. Nada foi emitido." };
    }
  }

  // Depois dos itens: o gatilho do banco já ajustou o total do documento,
  // e a receita precisa nascer com o valor final.
  if (status === "pago") {
    await lancarReceita(supabase, user.id, documento.id);
  }

  revalidarEntradas();

  const rotulo = tipo === "recibo" ? "Recibo" : "Orçamento";
  return {
    sucesso:
      `${rotulo} #${documento.numero} emitido` +
      (status === "pago" ? " e lançado como recebido." : " — aguardando pagamento."),
  };
}

/**
 * Gera o lançamento de receita a partir de um documento.
 *
 * O índice único em documento_venda_id transforma uma segunda chamada em
 * violação de unicidade em vez de receita duplicada; por isso o erro aqui
 * é esperado e ignorado.
 */
async function lancarReceita(
  supabase: Awaited<ReturnType<typeof exigirUsuario>>["supabase"],
  userId: string,
  documentoId: string
): Promise<void> {
  const { data: documento } = await supabase
    .from("documentos_venda")
    .select("id, valor, descricao_servico, numero, natureza, clientes(nome)")
    .eq("id", documentoId)
    .eq("user_id", userId)
    .single();

  if (!documento) return;

  // Serviço e venda de produto são naturezas distintas e devem cair em
  // categorias distintas no relatório do contador.
  const nomeCategoria = documento.natureza === "produto" ? "Vendas" : "Serviços";

  const { data: categoria } = await supabase
    .from("categorias")
    .select("id")
    .eq("user_id", userId)
    .eq("nome", nomeCategoria)
    .maybeSingle();

  const cliente = Array.isArray(documento.clientes)
    ? documento.clientes[0]
    : documento.clientes;

  await supabase.from("lancamentos").insert({
    user_id: userId,
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
}

/** Baixa de uma cobrança pendente: muda o status e gera a receita. */
export async function marcarComoPago(formData: FormData): Promise<void> {
  const { supabase, user } = await exigirUsuario();
  const id = lerTexto(formData, "id");
  if (!id) return;

  const { data: documento } = await supabase
    .from("documentos_venda")
    .select("id, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!documento || documento.status === "pago") return;

  await supabase
    .from("documentos_venda")
    .update({ status: "pago" })
    .eq("id", id)
    .eq("user_id", user.id);

  await lancarReceita(supabase, user.id, id);

  revalidarEntradas();
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

  revalidarEntradas();
}

/**
 * Registra que a nota fiscal daquela entrada foi emitida.
 *
 * A emissão acontece fora daqui — no Emissor Nacional ou na SEFAZ. O que
 * guardamos é o número, para o relatório do contador bater com o que o
 * governo recebeu.
 */
export async function registrarNotaFiscal(
  _anterior: EstadoForm,
  formData: FormData
): Promise<EstadoForm> {
  const { supabase, user } = await exigirUsuario();

  const id = lerTexto(formData, "id");
  const numero = lerTexto(formData, "nf_numero");
  if (!id) return { erro: "Documento não identificado." };
  if (!numero) return { erro: "Informe o número da nota." };

  const { error } = await supabase
    .from("documentos_venda")
    .update({
      nf_numero: numero,
      nf_emitida_em: new Date().toISOString(),
      nf_link: lerOpcional(formData, "nf_link"),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { erro: "Não foi possível salvar." };

  revalidarEntradas();
  revalidatePath("/nota-fiscal");
  return { sucesso: `Nota ${numero} registrada.` };
}
