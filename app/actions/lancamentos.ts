"use server";

import { revalidatePath } from "next/cache";
import { exigirUsuario } from "@/lib/auth";
import { hoje } from "@/lib/formato";
import {
  descricaoPadrao,
  ehNaturezaSaida,
  SAIDA,
  type NaturezaSaida,
} from "@/lib/lancamentos";
import {
  type EstadoForm,
  lerOpcional,
  lerTexto,
  lerValor,
} from "@/app/actions/tipos";

function atualizarTelas() {
  revalidatePath("/movimento");
  revalidatePath("/dashboard");
  revalidatePath("/relatorio");
  revalidatePath("/clientes");
  // A margem aparece dentro do recibo; sem isto ela ficaria desatualizada.
  revalidatePath("/recibo/[id]", "page");
}

/** Busca a categoria pelo nome; ela é criada junto com a conta. */
async function categoriaPorNome(
  supabase: Awaited<ReturnType<typeof exigirUsuario>>["supabase"],
  userId: string,
  nome: string
): Promise<string | null> {
  const { data } = await supabase
    .from("categorias")
    .select("id")
    .eq("user_id", userId)
    .eq("nome", nome)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Registra uma saída de dinheiro — custo do negócio, retirada do dono ou
 * o DAS.
 *
 * Os três eram três caminhos diferentes: este formulário, um painel na
 * tela inicial e um botão "já paguei". Mesmo conceito, três regras. A
 * retirada, por exemplo, só aceitava a data de hoje, enquanto o custo
 * aceitava qualquer data — diferença que ninguém escolheu, só aconteceu.
 *
 * Entrada tem caminho próprio, em `criarDocumento`, porque toda entrada
 * gera recibo.
 */
export async function criarLancamento(
  _anterior: EstadoForm,
  formData: FormData
): Promise<EstadoForm> {
  const { supabase, user } = await exigirUsuario();

  const bruta = lerTexto(formData, "natureza_saida") || "custo";
  const natureza: NaturezaSaida = ehNaturezaSaida(bruta) ? bruta : "custo";

  const valor = lerValor(formData);
  const competencia = lerTexto(formData, "data_competencia") || hoje();
  const descricao =
    lerTexto(formData, "descricao") || descricaoPadrao(natureza, competencia);

  if (!descricao) return { erro: "Descreva a saída." };
  if (valor === null) return { erro: "Informe um valor válido." };
  if (valor === 0) return { erro: "O valor precisa ser maior que zero." };

  // Categoria vira rótulo derivado nas naturezas que têm uma fixa: deixar a
  // pessoa escolher permitiria um DAS categorizado como "Alimentação", e o
  // relatório do contador sairia errado.
  const padrao = SAIDA[natureza].categoriaPadrao;
  const categoria = padrao
    ? await categoriaPorNome(supabase, user.id, padrao)
    : lerOpcional(formData, "categoria_id");

  const { error } = await supabase.from("lancamentos").insert({
    user_id: user.id,
    tipo: "despesa",
    natureza_saida: natureza,
    descricao,
    valor,
    data_competencia: competencia,
    categoria_id: categoria,
    fornecedor_cliente: lerOpcional(formData, "fornecedor_cliente"),
    origem: "manual",
    pago: formData.get("pago") !== "nao",
    // Vínculo opcional com o trabalho que gerou o gasto. É o que permite
    // responder "esse serviço deu lucro?" — sem ele o app só sabe somar.
    // Só custo aceita: retirada não é despesa de trabalho nenhum, e deixar
    // entrar faria um serviço lucrativo parecer prejuízo.
    custo_de_documento_id: SAIDA[natureza].aceitaVinculo
      ? lerOpcional(formData, "custo_de_documento_id")
      : null,
  });

  if (error) {
    if (error.code === "23505" && natureza === "imposto") {
      return {
        erro: "Já existe DAS lançado nesta competência. Se está pagando um mês atrasado, mude a data para o mês a que ele se refere.",
      };
    }
    return { erro: "Não foi possível salvar. Tente de novo." };
  }

  atualizarTelas();
  return { sucesso: `${SAIDA[natureza].rotulo} lançado.` };
}

export async function excluirLancamento(formData: FormData): Promise<void> {
  const { supabase, user } = await exigirUsuario();
  const id = lerTexto(formData, "id");
  if (!id) return;

  // O filtro por user_id é redundante com a RLS, mas mantém a intenção
  // explícita no código — quem lê a query vê o escopo sem precisar
  // conhecer as policies do banco.
  await supabase.from("lancamentos").delete().eq("id", id).eq("user_id", user.id);

  atualizarTelas();
}

/**
 * Corrige uma saída.
 *
 * Só despesa passa por aqui: receita pertence a um documento numerado e é
 * corrigida por `editarDocumento`, que mantém recibo e lançamento alinhados.
 */
export async function editarLancamento(
  _anterior: EstadoForm,
  formData: FormData
): Promise<EstadoForm> {
  const { supabase, user } = await exigirUsuario();

  const id = lerTexto(formData, "id");
  if (!id) return { erro: "Lançamento não identificado." };

  const descricao = lerTexto(formData, "descricao");
  const valor = lerValor(formData);
  if (!descricao) return { erro: "Descreva a saída." };
  if (valor === null || valor === 0) return { erro: "Informe um valor válido." };

  const { data: atual } = await supabase
    .from("lancamentos")
    .select("id, tipo, natureza_saida, documento_venda_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!atual) return { erro: "Lançamento não encontrado." };
  if (atual.documento_venda_id) {
    return { erro: "Esta entrada pertence a um recibo. Edite o recibo." };
  }

  // A natureza não muda na edição: transformar retirada em custo mexeria
  // na margem de um trabalho e no caixa de um mês já olhado. Para trocar,
  // exclui e lança de novo.
  const ehCusto = atual.natureza_saida === "custo";

  const { error } = await supabase
    .from("lancamentos")
    .update({
      descricao,
      valor,
      data_competencia: lerTexto(formData, "data_competencia") || hoje(),
      ...(ehCusto
        ? {
            categoria_id: lerOpcional(formData, "categoria_id"),
            custo_de_documento_id: lerOpcional(formData, "custo_de_documento_id"),
          }
        : {}),
      fornecedor_cliente: lerOpcional(formData, "fornecedor_cliente"),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { erro: "Não foi possível salvar." };

  atualizarTelas();
  return { sucesso: "Saída atualizada." };
}
