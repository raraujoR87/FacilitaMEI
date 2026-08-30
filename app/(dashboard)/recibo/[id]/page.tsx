import { notFound } from "next/navigation";
import Link from "next/link";
import { exigirUsuario } from "@/lib/auth";
import { formatarData, formatarMoeda } from "@/lib/formato";
import { formatarDocumento, situacaoFiscal, type Natureza } from "@/lib/fiscal";
import { gerarBrCode, perfilTemPix, type TipoChavePix } from "@/lib/pix";
import { Carimbo } from "@/components/ui/campos";
import { BotaoCopiar } from "@/components/ui/botao-copiar";
import { BotaoImprimir } from "@/app/(dashboard)/relatorio/botao-imprimir";
import { formatarMomento } from "@/lib/admin";
import { temRecurso } from "@/lib/planos";
import { Compartilhar } from "./compartilhar";

type Item = {
  descricao: string;
  quantidade: number;
  unidade: string;
  valor_unitario: number;
  total: number;
};

type Documento = {
  id: string;
  numero: number;
  tipo: "recibo" | "orcamento";
  natureza: Natureza;
  descricao_servico: string;
  valor: number;
  status: "pendente" | "pago" | "cancelado";
  data_emissao: string;
  data_vencimento: string | null;
  observacoes: string | null;
  nf_numero: string | null;
  token_publico: string | null;
  clientes: { nome: string; documento: string | null; telefone: string | null } | null;
  itens_documento: Item[];
};

export default async function ReciboPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ bloqueado?: string }>;
}) {
  const { id } = await params;
  const { bloqueado } = await searchParams;
  const { supabase, user } = await exigirUsuario();

  const [{ data }, { data: perfil }] = await Promise.all([
    supabase
      .from("documentos_venda")
      .select(
        "id, numero, tipo, natureza, descricao_servico, valor, status, data_emissao, data_vencimento, observacoes, nf_numero, token_publico, clientes(nome, documento, telefone), itens_documento(descricao, quantidade, unidade, valor_unitario, total)"
      )
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("perfis")
      .select(
        "nome_negocio, cnpj, municipio, uf, chave_pix, tipo_chave_pix, nome_titular_pix, cidade_pix, logo_url, cor_marca, plano, plano_expira_em"
      )
      .eq("id", user.id)
      .single(),
  ]);

  const { data: historico } = await supabase
    .from("alteracoes")
    .select("campo, valor_anterior, valor_novo, alterado_em")
    .eq("registro_id", id)
    .order("alterado_em", { ascending: false })
    .limit(20);

  // Documento de outro tenant cai aqui como inexistente: a RLS não devolve
  // a linha, e 404 não revela que ela existe.
  if (!data) notFound();

  const doc = data as unknown as Documento;
  const cliente = Array.isArray(doc.clientes) ? doc.clientes[0] : doc.clientes;
  const itens = [...(doc.itens_documento ?? [])];
  const fiscal = situacaoFiscal(doc.natureza, cliente?.documento);

  const brcode =
    doc.tipo === "recibo" && doc.status === "pendente" && perfil && perfilTemPix(perfil)
      ? gerarBrCode({
          chave: perfil.chave_pix!,
          tipoChave: perfil.tipo_chave_pix as TipoChavePix,
          nomeTitular: perfil.nome_titular_pix!,
          cidade: perfil.cidade_pix ?? "",
          valor: Number(doc.valor),
          identificador: `AMEI${doc.numero}`,
        })
      : null;

  const titulo = doc.tipo === "recibo" ? "Recibo" : "Orçamento";
  const editavel = !doc.nf_numero && doc.status !== "cancelado";

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-5 nao-imprimir">
        <Link href="/movimento" className="text-sm underline">
          ← Voltar ao movimento
        </Link>
        <div className="flex items-center gap-2">
          {editavel && (
            <Link href={`/recibo/${id}/editar`} className="botao botao-secundario">
              Corrigir
            </Link>
          )}
          <BotaoImprimir />
        </div>
      </div>

      {bloqueado && (
        <p className="aviso aviso-erro mb-5 nao-imprimir">
          {doc.nf_numero
            ? `Este documento tem a nota ${doc.nf_numero} emitida e não pode mais ser alterado — mudar o valor divergiria do que o governo recebeu. Cancele e emita outro.`
            : "Documento cancelado não pode ser editado."}
        </p>
      )}

      <article className="fita-recibo px-6 py-8 md:px-10 md:py-10">
        <header className="text-center">
          {perfil?.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={perfil.logo_url}
              alt={perfil.nome_negocio ?? ""}
              className="max-h-16 mx-auto mb-3 object-contain"
            />
          )}
          <p style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}>
            {perfil?.nome_negocio ?? "Meu negócio"}
          </p>
          {perfil?.cnpj && (
            <p className="text-xs" style={{ color: "var(--tinta-suave)" }}>
              CNPJ {formatarDocumento(perfil.cnpj)}
            </p>
          )}
          {perfil?.municipio && (
            <p className="text-xs" style={{ color: "var(--tinta-suave)" }}>
              {perfil.municipio}
              {perfil.uf ? ` — ${perfil.uf}` : ""}
            </p>
          )}

          <p
            className="text-xs uppercase tracking-widest mt-4"
            style={{ color: "var(--tinta-suave)" }}
          >
            <span style={{ color: perfil?.cor_marca ?? undefined }}>
              {titulo} nº {doc.numero}
            </span>{" "}
            ·{" "}
            {doc.natureza === "servico" ? "Serviço prestado" : "Produto vendido"}
          </p>
          <p className="text-xs" style={{ color: "var(--tinta-suave)" }}>
            Emitido em {formatarData(doc.data_emissao)}
          </p>
        </header>

        <div className="my-5 border-t border-dashed" style={{ borderColor: "var(--borda)" }} />

        <section className="text-sm mb-5">
          <p>
            <span style={{ color: "var(--tinta-suave)" }}>Cliente: </span>
            {cliente?.nome ?? "Não identificado"}
          </p>
          {cliente?.documento && (
            <p>
              <span style={{ color: "var(--tinta-suave)" }}>
                {cliente.documento.replace(/\D/g, "").length === 14 ? "CNPJ: " : "CPF: "}
              </span>
              {formatarDocumento(cliente.documento)}
            </p>
          )}
          <p>
            <span style={{ color: "var(--tinta-suave)" }}>Referente a: </span>
            {doc.descricao_servico}
          </p>
        </section>

        {itens.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: "var(--tinta-suave)" }}>
                  <th className="text-left font-medium pb-1">Item</th>
                  <th className="text-right font-medium pb-1 whitespace-nowrap">Qtd</th>
                  <th className="text-right font-medium pb-1 whitespace-nowrap">Unitário</th>
                  <th className="text-right font-medium pb-1 whitespace-nowrap">Total</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((item, i) => (
                  <tr key={i} className="border-t" style={{ borderColor: "var(--borda)" }}>
                    <td className="py-1.5 pr-2">{item.descricao}</td>
                    <td className="py-1.5 text-right valor whitespace-nowrap">
                      {Number(item.quantidade).toLocaleString("pt-BR", {
                        maximumFractionDigits: 3,
                      })}{" "}
                      {item.unidade}
                    </td>
                    <td className="py-1.5 text-right valor whitespace-nowrap">
                      {formatarMoeda(Number(item.valor_unitario))}
                    </td>
                    <td className="py-1.5 text-right valor whitespace-nowrap">
                      {formatarMoeda(Number(item.total))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="dica">Sem detalhamento por item.</p>
        )}

        <div className="my-5 border-t border-dashed" style={{ borderColor: "var(--borda)" }} />

        <div className="flex justify-between items-baseline">
          <span className="font-semibold">Total</span>
          <span className="valor text-xl" style={{ color: perfil?.cor_marca ?? undefined }}>
            {formatarMoeda(Number(doc.valor))}
          </span>
        </div>

        {doc.data_vencimento && doc.status === "pendente" && (
          <p className="dica text-right">
            Vence em {formatarData(doc.data_vencimento)}
          </p>
        )}

        {doc.observacoes && (
          <section className="mt-5 text-sm">
            <p className="text-xs uppercase tracking-widest" style={{ color: "var(--tinta-suave)" }}>
              Observações
            </p>
            <p className="whitespace-pre-line">{doc.observacoes}</p>
          </section>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <Carimbo status={doc.status} />
          {fiscal.documento && (
            <span className="text-xs" style={{ color: "var(--tinta-suave)" }}>
              {doc.nf_numero
                ? `${fiscal.documento} ${doc.nf_numero}`
                : fiscal.obrigatoria
                ? `${fiscal.documento} pendente de emissão`
                : "Nota fiscal dispensada"}
            </span>
          )}
        </div>

        {brcode && (
          <div className="mt-6 nao-imprimir">
            <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--tinta-suave)" }}>
              PIX copia e cola
            </p>
            <code className="brcode block mb-2">{brcode}</code>
            <BotaoCopiar texto={brcode} />
          </div>
        )}
      </article>

      <Compartilhar
        id={doc.id}
        tokenExistente={doc.token_publico}
        liberado={temRecurso(perfil, "linkPublico")}
        ehOrcamento={doc.tipo === "orcamento"}
      />

      {historico && historico.length > 0 && (
        <section className="mt-6 nao-imprimir">
          <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--tinta-suave)" }}>
            Histórico de alterações
          </p>
          <div
            className="rounded-lg border divide-y text-sm"
            style={{ borderColor: "var(--borda)", background: "#fff" }}
          >
            {historico.map((h, i) => (
              <div key={i} className="px-4 py-2 flex flex-wrap justify-between gap-2">
                <span>
                  <strong>{ROTULO_CAMPO[h.campo] ?? h.campo}</strong>{" "}
                  <span style={{ color: "var(--tinta-suave)" }}>
                    {exibirValor(h.campo, h.valor_anterior)} →{" "}
                    {exibirValor(h.campo, h.valor_novo)}
                  </span>
                </span>
                <span className="valor text-xs" style={{ color: "var(--tinta-suave)" }}>
                  {formatarMomento(h.alterado_em)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * O histórico guarda tudo como texto cru do banco. Dinheiro e data crus
 * ("400.00", "2026-09-15") destoam no meio de uma tela em português.
 */
function exibirValor(campo: string, valor: string | null): string {
  if (valor === null || valor === "") return "vazio";
  if (campo === "valor") return formatarMoeda(Number(valor));
  if (campo === "data_vencimento") return formatarData(valor);
  return valor;
}

/** Nomes de coluna não servem para o cliente ler. */
const ROTULO_CAMPO: Record<string, string> = {
  valor: "Valor",
  descricao_servico: "Descrição",
  status: "Situação",
  natureza: "Natureza",
  data_vencimento: "Vencimento",
  nf_numero: "Nota fiscal",
};
