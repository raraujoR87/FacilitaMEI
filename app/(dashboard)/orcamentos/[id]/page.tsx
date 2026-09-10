import { notFound } from "next/navigation";
import Link from "next/link";
import { CircleCheck, Download } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { formatarData, formatarMoeda, formatarMomento, hoje } from "@/lib/formato";
import { formatarDocumento } from "@/lib/fiscal";
import { COLUNAS_PLANO, temRecurso } from "@/lib/planos";
import {
  calcularTotais,
  diasDeValidade,
  ROTULO_ORCAMENTO,
  situacaoDoOrcamento,
  type ItemOrcamento,
} from "@/lib/orcamento";
import { cancelarDocumento } from "@/app/actions/vendas";
import { BotaoQueRemove, LinhaAcao } from "@/components/ui/linha-acao";
import { Compartilhar } from "@/app/(dashboard)/recibo/[id]/compartilhar";
import { ConverterOrcamento } from "@/app/(dashboard)/cobranca/converter";

export default async function PropostaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, user } = await exigirUsuario();

  const [{ data }, { data: perfil }] = await Promise.all([
    supabase
      .from("documentos_venda")
      .select(
        "id, numero, tipo, natureza, descricao_servico, valor, desconto, desconto_percentual, status, data_emissao, validade_em, condicoes_pagamento, prazo_execucao, garantia, observacoes, token_publico, aceito_em, aceito_por, clientes(nome, documento, telefone, email), itens_documento(descricao, quantidade, unidade, valor_unitario, total, ordem)"
      )
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("perfis")
      .select(`nome_negocio, assinatura_nome, ${COLUNAS_PLANO}`)
      .eq("id", user.id)
      .single(),
  ]);

  // Documento de outro tenant não volta pela RLS: 404 não revela que ele
  // existe.
  if (!data || data.tipo !== "orcamento") notFound();

  const cliente = Array.isArray(data.clientes) ? data.clientes[0] : data.clientes;
  const itens = [...(data.itens_documento ?? [])].sort(
    (a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)
  ) as ItemOrcamento[];

  const hojeISO = hoje();
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
    hojeISO
  );

  const rotulo = ROTULO_ORCAMENTO[situacao];
  const dias = diasDeValidade(data.validade_em, hojeISO);
  const totais = calcularTotais(
    itens,
    {
      valor: Number(data.desconto ?? 0),
      percentual:
        data.desconto_percentual === null ? null : Number(data.desconto_percentual),
    },
    Number(data.valor) + Number(data.desconto ?? 0)
  );
  const editavel = situacao === "rascunho" || situacao === "aguardando" || situacao === "vencido";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <Link href="/orcamentos" className="text-sm underline">
          ← Voltar às propostas
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {/* Download direto, não impressão: no celular, imprimir-para-PDF
              é um caminho que ninguém completa — e o que fecha negócio é o
              anexo pronto para encaminhar. */}
          <a href={`/api/orcamentos/${id}/pdf`} className="botao botao-secundario">
            <Download size={15} aria-hidden />
            Baixar PDF
          </a>
          {editavel && (
            <Link href={`/orcamentos/${id}/editar`} className="botao botao-secundario">
              Corrigir
            </Link>
          )}
        </div>
      </div>

      {situacao === "aceito" && (
        <p
          className="aviso mb-5 flex items-center gap-2"
          style={{
            borderColor: "var(--positivo)",
            background: "rgba(47,110,91,0.08)",
          }}
          role="status"
        >
          <CircleCheck size={16} aria-hidden style={{ color: "var(--positivo)" }} />
          <span>
            Aceito por <strong>{data.aceito_por}</strong> em{" "}
            {formatarMomento(data.aceito_em)}. Gere a cobrança para o valor
            entrar em &quot;A receber&quot;.
          </span>
        </p>
      )}

      {situacao === "vencido" && (
        <p className="aviso aviso-erro mb-5">
          A validade venceu em {formatarData(data.validade_em!)}. Corrija os
          valores e mande de novo, ou faça uma proposta nova — o cliente não
          deve aceitar um preço que você já não pratica.
        </p>
      )}

      <article className="fita-recibo px-6 py-7 mb-6">
        <div className="flex flex-wrap justify-between items-start gap-3 mb-5">
          <div>
            <p
              className="text-xs uppercase tracking-widest"
              style={{ color: "var(--tinta-suave)" }}
            >
              Orçamento nº {data.numero}
            </p>
            <h1
              className="text-xl"
              style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}
            >
              {data.descricao_servico}
            </h1>
            <p className="text-xs" style={{ color: "var(--tinta-suave)" }}>
              {data.natureza === "servico" ? "Prestação de serviço" : "Fornecimento de produto"}{" "}
              · emitida em {formatarData(data.data_emissao)}
            </p>
          </div>
          <span className="text-sm font-medium" style={{ color: rotulo.cor }}>
            {rotulo.texto}
          </span>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mb-6">
          <div>
            <dt className="text-xs" style={{ color: "var(--tinta-suave)" }}>
              Cliente
            </dt>
            <dd>
              {cliente?.nome ?? "Sem cliente"}
              {cliente?.documento && (
                <span className="block text-xs" style={{ color: "var(--tinta-suave)" }}>
                  {formatarDocumento(cliente.documento)}
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs" style={{ color: "var(--tinta-suave)" }}>
              Validade
            </dt>
            <dd>
              {data.validade_em ? formatarData(data.validade_em) : "sem prazo"}
              {situacao === "aguardando" && dias !== null && (
                <span className="block text-xs" style={{ color: "var(--tinta-suave)" }}>
                  {dias === 0 ? "vence hoje" : `mais ${dias} dia${dias === 1 ? "" : "s"}`}
                </span>
              )}
            </dd>
          </div>
        </dl>

        {itens.length > 0 && (
          <div className="mb-5 overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: "26rem" }}>
              <thead>
                <tr>
                  <th className="text-left pb-2 font-medium text-xs" style={{ color: "var(--tinta-suave)" }}>
                    Descrição
                  </th>
                  <th className="text-right pb-2 font-medium text-xs" style={{ color: "var(--tinta-suave)" }}>
                    Qtd
                  </th>
                  <th className="text-right pb-2 font-medium text-xs" style={{ color: "var(--tinta-suave)" }}>
                    Valor un.
                  </th>
                  <th className="text-right pb-2 font-medium text-xs" style={{ color: "var(--tinta-suave)" }}>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {itens.map((item, i) => (
                  <tr key={i} className="border-t" style={{ borderColor: "var(--borda)" }}>
                    <td className="py-2 pr-3">{item.descricao}</td>
                    <td className="py-2 text-right valor whitespace-nowrap">
                      {Number(item.quantidade)} {item.unidade}
                    </td>
                    <td className="py-2 text-right valor">
                      {formatarMoeda(Number(item.valor_unitario))}
                    </td>
                    <td className="py-2 text-right valor font-semibold">
                      {formatarMoeda(Number(item.total))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div
          className="border-t pt-4 flex flex-col items-end gap-1"
          style={{ borderColor: "var(--borda)" }}
        >
          {totais.desconto > 0 && (
            <>
              <p className="text-sm" style={{ color: "var(--tinta-suave)" }}>
                Subtotal <span className="valor">{formatarMoeda(totais.subtotal)}</span>
              </p>
              <p className="text-sm" style={{ color: "var(--tinta-suave)" }}>
                Desconto
                {totais.percentualDesconto ? ` (${totais.percentualDesconto}%)` : ""}{" "}
                <span className="valor">− {formatarMoeda(totais.desconto)}</span>
              </p>
            </>
          )}
          <p className="valor text-2xl" style={{ color: "var(--positivo)" }}>
            {formatarMoeda(Number(data.valor))}
          </p>
        </div>

        {(data.condicoes_pagamento || data.prazo_execucao || data.garantia || data.observacoes) && (
          <dl
            className="mt-6 pt-4 border-t grid gap-3 text-sm"
            style={{ borderColor: "var(--borda)" }}
          >
            <Condicao rotulo="Pagamento" texto={data.condicoes_pagamento} />
            <Condicao rotulo="Prazo de execução" texto={data.prazo_execucao} />
            <Condicao rotulo="Garantia" texto={data.garantia} />
            <Condicao rotulo="Observações" texto={data.observacoes} />
          </dl>
        )}

        <p
          className="mt-6 pt-4 border-t text-xs"
          style={{ borderColor: "var(--borda)", color: "var(--tinta-suave)" }}
        >
          {perfil?.assinatura_nome ?? perfil?.nome_negocio}
        </p>
      </article>

      <Compartilhar
        id={data.id}
        tokenExistente={data.token_publico}
        liberado={temRecurso(perfil, "linkPublico")}
        ehOrcamento
      />

      {situacao !== "convertido" && situacao !== "recusado" && (
        <LinhaAcao className="mt-6 flex flex-wrap items-center gap-3">
          {situacao === "aceito" && (
            <ConverterOrcamento id={data.id} numero={data.numero} />
          )}
          <BotaoQueRemove acao={cancelarDocumento} id={data.id} variante="discreto">
            Cancelar proposta
          </BotaoQueRemove>
        </LinhaAcao>
      )}
    </div>
  );
}

function Condicao({ rotulo, texto }: { rotulo: string; texto: string | null }) {
  if (!texto) return null;
  return (
    <div>
      <dt className="text-xs" style={{ color: "var(--tinta-suave)" }}>
        {rotulo}
      </dt>
      <dd className="whitespace-pre-line">{texto}</dd>
    </div>
  );
}
