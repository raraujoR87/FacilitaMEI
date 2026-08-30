import { notFound } from "next/navigation";
import Link from "next/link";
import { exigirUsuario } from "@/lib/auth";
import { formatarData, formatarMoeda } from "@/lib/formato";
import { formatarDocumento, situacaoFiscal, type Natureza } from "@/lib/fiscal";
import { gerarBrCode, perfilTemPix, type TipoChavePix } from "@/lib/pix";
import { Carimbo } from "@/components/ui/campos";
import { BotaoCopiar } from "@/components/ui/botao-copiar";
import { BotaoImprimir } from "@/app/(dashboard)/relatorio/botao-imprimir";

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
  clientes: { nome: string; documento: string | null; telefone: string | null } | null;
  itens_documento: Item[];
};

export default async function ReciboPage({
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
        "id, numero, tipo, natureza, descricao_servico, valor, status, data_emissao, data_vencimento, observacoes, nf_numero, clientes(nome, documento, telefone), itens_documento(descricao, quantidade, unidade, valor_unitario, total)"
      )
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("perfis")
      .select(
        "nome_negocio, cnpj, municipio, uf, chave_pix, tipo_chave_pix, nome_titular_pix, cidade_pix"
      )
      .eq("id", user.id)
      .single(),
  ]);

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

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-5 nao-imprimir">
        <Link href="/movimento" className="text-sm underline">
          ← Voltar ao movimento
        </Link>
        <BotaoImprimir />
      </div>

      <article className="fita-recibo px-6 py-8 md:px-10 md:py-10">
        <header className="text-center">
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
            {titulo} nº {doc.numero} ·{" "}
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
          <span className="valor text-xl">{formatarMoeda(Number(doc.valor))}</span>
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
    </div>
  );
}
