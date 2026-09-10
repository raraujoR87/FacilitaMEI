import { notFound } from "next/navigation";
import Link from "next/link";
import { exigirUsuario } from "@/lib/auth";
import { hoje } from "@/lib/formato";
import { situacaoDoOrcamento } from "@/lib/orcamento";
import { FormularioEdicaoOrcamento } from "./formulario";

export default async function EditarPropostaPage({
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
        "id, numero, tipo, natureza, descricao_servico, valor, desconto, desconto_percentual, status, data_emissao, validade_em, condicoes_pagamento, prazo_execucao, garantia, observacoes, cliente_id, aceito_em, aceito_por, token_publico, itens_documento(descricao, quantidade, unidade, valor_unitario, ordem)"
      )
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("clientes")
      .select("id, nome")
      .eq("user_id", user.id)
      .is("arquivado_em", null)
      .order("nome"),
  ]);

  if (!data || data.tipo !== "orcamento") notFound();

  const situacao = situacaoDoOrcamento(
    {
      id: data.id,
      numero: data.numero,
      descricao_servico: data.descricao_servico,
      valor: Number(data.valor),
      desconto: Number(data.desconto ?? 0),
      status: data.status,
      data_emissao: data.data_emissao,
      validade_em: data.validade_em,
      aceito_em: data.aceito_em,
      aceito_por: data.aceito_por,
      token_publico: data.token_publico,
    },
    hoje()
  );

  // Depois de aceita, mexer no preço muda o que o cliente concordou em
  // pagar. O caminho é cancelar e propor de novo, que deixa rastro.
  if (situacao === "aceito" || situacao === "convertido" || situacao === "recusado") {
    return (
      <div>
        <Link href={`/orcamentos/${id}`} className="text-sm underline">
          ← Voltar à proposta
        </Link>
        <p className="aviso aviso-erro mt-5">
          {situacao === "aceito"
            ? "O cliente já aceitou esta proposta. Para mudar o preço, cancele e faça outra — assim fica registrado o que ele aceitou."
            : "Esta proposta já saiu do fluxo e não pode mais ser alterada."}
        </p>
      </div>
    );
  }

  const itens = [...(data.itens_documento ?? [])].sort(
    (a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)
  );

  return (
    <div>
      <Link href={`/orcamentos/${id}`} className="text-sm underline">
        ← Voltar à proposta
      </Link>

      <h1
        className="text-2xl mt-4 mb-1"
        style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}
      >
        Corrigir proposta #{data.numero}
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--tinta-suave)" }}>
        Se o cliente já recebeu o link, ele passa a ver a versão corrigida.
      </p>

      <FormularioEdicaoOrcamento
        orcamento={{
          id: data.id,
          natureza: data.natureza as "servico" | "produto",
          descricao_servico: data.descricao_servico,
          valor: Number(data.valor),
          desconto: Number(data.desconto ?? 0),
          desconto_percentual:
            data.desconto_percentual === null ? null : Number(data.desconto_percentual),
          validade_em: data.validade_em,
          condicoes_pagamento: data.condicoes_pagamento,
          prazo_execucao: data.prazo_execucao,
          garantia: data.garantia,
          observacoes: data.observacoes,
          cliente_id: data.cliente_id,
        }}
        itens={itens.map((i) => ({
          descricao: i.descricao,
          quantidade: Number(i.quantidade),
          unidade: i.unidade,
          valorUnitario: Number(i.valor_unitario),
        }))}
        clientes={clientes ?? []}
      />
    </div>
  );
}
