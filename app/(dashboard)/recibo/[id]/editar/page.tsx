import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { exigirUsuario } from "@/lib/auth";
import type { LinhaItem } from "@/components/ui/itens-documento";
import { FormularioEdicao, type DocumentoEdicao } from "./formulario";

export default async function EditarReciboPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, user } = await exigirUsuario();

  const [{ data }, { data: clientes }] = await Promise.all([
    supabase
      .from("documentos_venda")
      .select(
        "id, numero, tipo, natureza, descricao_servico, valor, status, cliente_id, data_vencimento, observacoes, nf_numero, itens_documento(descricao, quantidade, unidade, valor_unitario, ordem)"
      )
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("clientes")
      .select("id, nome, documento")
      .eq("user_id", user.id)
      .order("nome"),
  ]);

  if (!data) notFound();

  // A trava também vale na entrada da tela: deixar o formulário abrir para
  // depois recusar no envio seria fazer a pessoa digitar à toa.
  if (data.nf_numero || data.status === "cancelado") {
    redirect(`/recibo/${id}?bloqueado=1`);
  }

  const itens: LinhaItem[] = ((data.itens_documento ?? []) as {
    descricao: string;
    quantidade: number;
    unidade: string;
    valor_unitario: number;
    ordem: number;
  }[])
    .sort((a, b) => a.ordem - b.ordem)
    .map((item, i) => ({
      chave: i + 1,
      descricao: item.descricao,
      quantidade: String(Number(item.quantidade)).replace(".", ","),
      unidade: item.unidade,
      centavos: Math.round(Number(item.valor_unitario) * 100),
    }));

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-5">
        <Link href={`/recibo/${id}`} className="text-sm underline">
          ← Voltar ao documento
        </Link>
      </div>

      <h1 className="text-2xl mb-1" style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}>
        Corrigir {data.tipo === "recibo" ? "recibo" : "orçamento"} #{data.numero}
      </h1>
      <p className="dica mb-6">
        Toda alteração fica registrada no histórico do documento, com o valor
        anterior.
      </p>

      <FormularioEdicao
        documento={data as unknown as DocumentoEdicao}
        itens={itens}
        clientes={clientes ?? []}
      />
    </div>
  );
}
