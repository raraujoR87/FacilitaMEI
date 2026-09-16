"use server";

import { revalidatePath } from "next/cache";
import { exigirUsuario } from "@/lib/auth";
import { hoje, lerNumeroBR } from "@/lib/formato";
import { apenasDigitos, documentoValido } from "@/lib/fiscal";
import {
  type EstadoForm,
  lerOpcional,
  lerTexto,
  lerValor,
  mensagemDeLimite,
} from "@/app/actions/tipos";

type ItemEntrada = {
  descricao: string;
  quantidade: number;
  unidade: string;
  valorUnitario: number;
  catalogoItemId: string | null;
  custoUnitario: number;
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
  // Vêm do catálogo, quando a linha foi escolhida em vez de digitada. O
  // custo é fotografia: mudar o catálogo depois não pode reescrever a
  // margem de um trabalho já entregue.
  const catalogo = formData.getAll("item_catalogo_id").map(String);
  const custos = formData.getAll("item_custo").map(String);

  return descricoes
    .map((descricao, i) => ({
      descricao: descricao.trim(),
      quantidade: lerNumeroBR(quantidades[i] ?? "1"),
      unidade: (unidades[i] ?? "un").trim() || "un",
      valorUnitario: lerNumeroBR(valores[i] ?? "0"),
      catalogoItemId: (catalogo[i] ?? "").trim() || null,
      custoUnitario: lerNumeroBR(custos[i] ?? "0"),
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

  // Cliente novo cadastrado na hora da venda.
  //
  // Antes era preciso sair, ir em Clientes, cadastrar e voltar — e no
  // balcão, com o cliente esperando, ninguém faz isso: emite sem cliente e
  // perde o vínculo para sempre. O cadastro nasce aqui e o documento já
  // sai amarrado.
  const clienteExistente = lerOpcional(formData, "cliente_id");
  let clienteId = clienteExistente;

  if (!clienteExistente) {
    const nomeNovo = lerTexto(formData, "cliente_novo_nome");
    if (nomeNovo) {
      const documentoNovo = apenasDigitos(lerTexto(formData, "cliente_novo_documento"));
      if (documentoNovo && !documentoValido(documentoNovo)) {
        return { erro: "CPF ou CNPJ do cliente é inválido. Confira os números." };
      }

      const { data: novo, error: erroCliente } = await supabase
        .from("clientes")
        .insert({
          user_id: user.id,
          nome: nomeNovo,
          documento: documentoNovo || null,
          telefone: lerOpcional(formData, "cliente_novo_telefone"),
        })
        .select("id")
        .single();

      if (erroCliente) {
        if (erroCliente.code === "23505") {
          return {
            erro: "Já existe um cliente com esse CPF/CNPJ. Escolha ele na lista em vez de cadastrar de novo.",
          };
        }
        return {
          erro:
            mensagemDeLimite(erroCliente.message) ??
            "Não foi possível cadastrar o cliente. Emita sem cliente e cadastre depois.",
        };
      }

      clienteId = novo.id;
    }
  }

  const { data: documento, error } = await supabase
    .from("documentos_venda")
    .insert({
      user_id: user.id,
      tipo,
      natureza,
      descricao_servico: descricao,
      valor: valorTotal,
      status,
      cliente_id: clienteId,
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
        catalogo_item_id: item.catalogoItemId,
        custo_unitario: item.custoUnitario,
        ordem: i + 1,
      }))
    );

    if (erroItens) {
      // Documento sem os itens que o justificam é pior que documento
      // nenhum: o cliente receberia um recibo sem o detalhe combinado.
      await supabase.from("documentos_venda").delete().eq("id", documento.id);
      return {
        erro:
          mensagemDeLimite(erroItens.message) ??
          "Não foi possível salvar os itens. Nada foi emitido.",
      };
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

  // `pago_em` sustenta a leitura de comportamento de pagamento: sem a data
  // da baixa não dá para saber quem paga em dia e quem sempre atrasa.
  await supabase
    .from("documentos_venda")
    .update({ status: "pago", pago_em: new Date().toISOString() })
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

/**
 * Corrige um documento já emitido.
 *
 * Nota fiscal registrada trava a edição: mudar o valor depois criaria
 * divergência com o que o governo recebeu, e o relatório do contador
 * deixaria de bater. Nesse caso o caminho é cancelar e emitir outro.
 *
 * Toda alteração fica registrada em `alteracoes` por gatilho do banco —
 * corrigir dinheiro sem deixar rastro é pior do que não poder corrigir.
 */
export async function editarDocumento(
  _anterior: EstadoForm,
  formData: FormData
): Promise<EstadoForm> {
  const { supabase, user } = await exigirUsuario();

  const id = lerTexto(formData, "id");
  if (!id) return { erro: "Documento não identificado." };

  const { data: atual } = await supabase
    .from("documentos_venda")
    .select("id, numero, status, nf_numero")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!atual) return { erro: "Documento não encontrado." };
  if (atual.nf_numero) {
    return {
      erro: `Este documento já tem a nota ${atual.nf_numero} emitida e não pode mais ser alterado. Cancele e emita outro.`,
    };
  }
  if (atual.status === "cancelado") {
    return { erro: "Documento cancelado não pode ser editado." };
  }

  const descricao = lerTexto(formData, "descricao_servico");
  const valor = lerValor(formData);
  const natureza = lerTexto(formData, "natureza");

  if (!descricao) return { erro: "Descreva o serviço ou produto." };
  if (valor === null) return { erro: "Informe um valor válido." };
  if (natureza !== "servico" && natureza !== "produto") {
    return { erro: "Escolha se foi serviço prestado ou produto vendido." };
  }

  const itens = lerItens(formData);
  const valorTotal = itens.length > 0 ? somarItens(itens) : valor;
  if (valorTotal === 0) return { erro: "O total ficou zerado." };

  const { error } = await supabase
    .from("documentos_venda")
    .update({
      natureza,
      descricao_servico: descricao,
      valor: valorTotal,
      cliente_id: lerOpcional(formData, "cliente_id"),
      data_vencimento: lerOpcional(formData, "data_vencimento"),
      observacoes: lerOpcional(formData, "observacoes"),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { erro: "Não foi possível salvar as alterações." };

  // Itens são substituídos por inteiro: reconciliar linha a linha traria
  // complexidade sem ganho, já que a tela sempre envia a lista completa.
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
        catalogo_item_id: item.catalogoItemId,
        custo_unitario: item.custoUnitario,
        ordem: i + 1,
      }))
    );
  }

  // O recibo pago já virou receita; sem isto o relatório mostraria o valor
  // antigo e o documento, o novo.
  if (atual.status === "pago") {
    await sincronizarReceita(supabase, user.id, id);
  }

  revalidarEntradas();
  revalidatePath(`/recibo/${id}`);
  return { sucesso: `Documento #${atual.numero} atualizado.` };
}

/** Realinha o lançamento de receita com o documento que o originou. */
async function sincronizarReceita(
  supabase: Awaited<ReturnType<typeof exigirUsuario>>["supabase"],
  userId: string,
  documentoId: string
): Promise<void> {
  const { data: documento } = await supabase
    .from("documentos_venda")
    .select("id, valor, descricao_servico, numero, clientes(nome)")
    .eq("id", documentoId)
    .eq("user_id", userId)
    .single();

  if (!documento) return;

  const cliente = Array.isArray(documento.clientes)
    ? documento.clientes[0]
    : documento.clientes;

  await supabase
    .from("lancamentos")
    .update({
      valor: documento.valor,
      descricao: `Recibo #${documento.numero} — ${documento.descricao_servico}`,
      fornecedor_cliente: cliente?.nome ?? null,
    })
    .eq("documento_venda_id", documentoId)
    .eq("user_id", userId);
}

/**
 * Emite o recibo de um orçamento que o cliente aceitou.
 *
 * O orçamento não muda de tipo: o número dele já foi entregue ao cliente e
 * a proposta é história. Nasce um recibo novo apontando para a origem, com
 * os mesmos itens — sem redigitar nada, que é o ponto.
 */
/**
 * Do orçamento aceito ao recibo, sem redigitar.
 *
 * Dois destinos, porque o aceite e o pagamento não acontecem juntos:
 *
 * - `pago = sim`: o cliente já pagou. O recibo nasce quitado, a receita
 *   entra no movimento na hora e o dinheiro aparece no caixa. É o caminho
 *   comum — o MEI só volta ao app depois de receber.
 * - sem `pago`: aceitou mas ainda não pagou. Vira cobrança em "A receber",
 *   e o dinheiro só entra quando a baixa for dada.
 *
 * O recibo continua editável nos dois casos: corrigir valor depois é
 * comum, e `editarDocumento` já acerta a receita junto quando está pago.
 */
export async function gerarReciboDeOrcamento(
  _anterior: EstadoForm,
  formData: FormData
): Promise<EstadoForm> {
  const { supabase, user } = await exigirUsuario();

  const id = lerTexto(formData, "id");
  if (!id) return { erro: "Orçamento não identificado." };

  const { data: orcamento } = await supabase
    .from("documentos_venda")
    .select(
      "id, numero, tipo, natureza, descricao_servico, valor, desconto, desconto_percentual, cliente_id, observacoes, aceito_em, status, itens_documento(descricao, quantidade, unidade, valor_unitario, ordem)"
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!orcamento) return { erro: "Orçamento não encontrado." };
  if (orcamento.tipo !== "orcamento") return { erro: "Este documento não é um orçamento." };
  if (orcamento.status === "cancelado") return { erro: "Orçamento cancelado." };

  // Incluir no movimento significa que o cliente pagou: o registro é do
  // dinheiro que já entrou, não de uma promessa.
  const jaPago = lerTexto(formData, "pago") === "sim";

  const { data: recibo, error } = await supabase
    .from("documentos_venda")
    .insert({
      user_id: user.id,
      tipo: "recibo",
      natureza: orcamento.natureza,
      descricao_servico: orcamento.descricao_servico,
      valor: orcamento.valor,
      // O desconto vem junto. Sem ele o recibo sairia pela soma crua dos
      // itens — cobrando do cliente mais do que ele aceitou.
      desconto: orcamento.desconto ?? 0,
      desconto_percentual: orcamento.desconto_percentual ?? null,
      status: jaPago ? "pago" : "pendente",
      // `pago_em` sustenta a leitura de comportamento de pagamento: sem a
      // data da baixa não dá para saber quem paga em dia e quem atrasa.
      pago_em: jaPago ? new Date().toISOString() : null,
      cliente_id: orcamento.cliente_id,
      data_emissao: hoje(),
      observacoes: orcamento.observacoes,
      gerado_de_orcamento_id: orcamento.id,
    })
    .select("id, numero")
    .single();

  if (error) {
    // O índice único faz o segundo clique cair aqui em vez de duplicar a
    // cobrança do mesmo serviço.
    if (error.code === "23505") {
      return { erro: "Este orçamento já virou recibo." };
    }
    return { erro: "Não foi possível gerar o recibo." };
  }

  const itens = (orcamento.itens_documento ?? []) as {
    descricao: string;
    quantidade: number;
    unidade: string;
    valor_unitario: number;
    ordem: number;
  }[];

  if (itens.length > 0) {
    await supabase.from("itens_documento").insert(
      itens
        .sort((a, b) => a.ordem - b.ordem)
        .map((item, i) => ({
          user_id: user.id,
          documento_venda_id: recibo.id,
          descricao: item.descricao,
          quantidade: item.quantidade,
          unidade: item.unidade,
          valor_unitario: item.valor_unitario,
          ordem: i + 1,
        }))
    );
  }

  // A receita entra DEPOIS dos itens: o gatilho de recálculo ajusta o
  // valor do documento quando eles chegam, e lançar antes gravaria o total
  // anterior no movimento.
  if (jaPago) {
    await lancarReceita(supabase, user.id, recibo.id);
  }

  // Sai de cena como "convertido", não como "pago": proposta não é dinheiro
  // recebido, e marcar assim faria o relatório por status contar errado.
  await supabase
    .from("documentos_venda")
    .update({ status: "convertido" })
    .eq("id", orcamento.id)
    .eq("user_id", user.id);

  revalidarEntradas();
  revalidatePath("/orcamentos");

  return {
    sucesso: jaPago
      ? `Recibo #${recibo.numero} incluído no movimento. Dá para corrigir valores por lá.`
      : `Recibo #${recibo.numero} emitido. Está em "A receber" até você dar a baixa.`,
  };
}
