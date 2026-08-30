"use server";

import { revalidatePath } from "next/cache";
import { exigirUsuario } from "@/lib/auth";
import { hoje } from "@/lib/formato";
import { CATEGORIA_DAS, CATEGORIA_RETIRADA } from "@/lib/caixa";
import { type EstadoForm, lerTexto, lerValor } from "@/app/actions/tipos";

/** Busca a categoria pelo nome; ela é criada junto com a conta. */
async function categoria(
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
 * Registra que o dono tirou dinheiro do negócio.
 *
 * Sem isso a retirada some no meio das despesas — ou pior, não é lançada, e
 * o saldo do app deixa de bater com a conta do banco. Categoria própria
 * para o relatório do contador não confundir retirada com custo.
 */
export async function registrarRetirada(
  _anterior: EstadoForm,
  formData: FormData
): Promise<EstadoForm> {
  const { supabase, user } = await exigirUsuario();

  const valor = lerValor(formData);
  if (valor === null || valor === 0) return { erro: "Informe quanto você tirou." };

  const { error } = await supabase.from("lancamentos").insert({
    user_id: user.id,
    tipo: "despesa",
    descricao: lerTexto(formData, "descricao") || "Retirada do dono",
    valor,
    data_competencia: hoje(),
    categoria_id: await categoria(supabase, user.id, CATEGORIA_RETIRADA),
    origem: "manual",
    pago: true,
  });

  if (error) return { erro: "Não foi possível registrar." };

  revalidatePath("/dashboard");
  revalidatePath("/movimento");
  revalidatePath("/relatorio");
  return { sucesso: "Retirada registrada." };
}

/**
 * Marca o DAS do mês como pago, lançando a despesa.
 *
 * O imposto é o gasto mais previsível do MEI e o mais esquecido. Registrar
 * pelo mesmo botão que confirma o pagamento evita a conta ficar sem ele.
 */
export async function pagarDas(
  _anterior: EstadoForm,
  formData: FormData
): Promise<EstadoForm> {
  const { supabase, user } = await exigirUsuario();

  const valor = lerValor(formData);
  if (valor === null || valor === 0) {
    return { erro: "Informe o valor do DAS em Configurações." };
  }

  const competencia = hoje();
  const { error } = await supabase.from("lancamentos").insert({
    user_id: user.id,
    tipo: "despesa",
    descricao: `DAS de ${competencia.slice(5, 7)}/${competencia.slice(0, 4)}`,
    valor,
    data_competencia: competencia,
    categoria_id: await categoria(supabase, user.id, CATEGORIA_DAS),
    origem: "manual",
    pago: true,
  });

  if (error) return { erro: "Não foi possível registrar o pagamento." };

  revalidatePath("/dashboard");
  revalidatePath("/movimento");
  revalidatePath("/relatorio");
  return { sucesso: "DAS deste mês registrado como pago." };
}
