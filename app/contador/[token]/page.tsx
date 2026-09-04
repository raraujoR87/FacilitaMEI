import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatarData, formatarMoeda } from "@/lib/formato";
import { formatarDocumento } from "@/lib/fiscal";
import { rotuloMes } from "@/lib/formato";

export const dynamic = "force-dynamic";

type Dados = {
  negocio: {
    nome: string | null;
    cnpj: string | null;
    municipio: string | null;
    uf: string | null;
    data_abertura: string | null;
  } | null;
  ano: number;
  expira_em: string;
  receita: { total: number; comercio_industria: number; servicos: number };
  por_mes: { mes: string; comercio_industria: number; servicos: number; total: number }[];
  despesas: { categoria: string; total: number }[];
  documentos: {
    data: string;
    numero: number;
    natureza: "servico" | "produto";
    descricao: string;
    valor: number;
    cliente: string | null;
    documento_cliente: string | null;
    nf_numero: string | null;
  }[];
};

/**
 * Portal do contador: somente leitura, sem login.
 *
 * O token no link é a credencial — mesmo desenho do recibo público. O que
 * ele mostra é o recorte da DASN-SIMEI: receita bruta do ano separada em
 * comércio/indústria e serviços, que é a divisão que a declaração pede.
 *
 * Fica de fora, de propósito: retirada do dono, margem por trabalho e
 * qualquer coisa que não seja fiscal. Não é assunto do contador aqui, e
 * quanto menos o link expõe, menos custa se ele vazar.
 */
export default async function PortalContador({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ ano?: string }>;
}) {
  const { token } = await params;
  const anoPedido = Number((await searchParams).ano);
  const ano = Number.isInteger(anoPedido) ? anoPedido : new Date().getFullYear();

  const supabase = await createClient();
  const { data } = await supabase.rpc("dados_para_contador", {
    p_token: token,
    p_ano: ano,
  });

  // Token errado, revogado e expirado caem todos aqui: distinguir diria a
  // quem tenta adivinhar que o token existe.
  if (!data) notFound();

  const d = data as Dados;
  const totalDespesas = d.despesas.reduce((s, x) => s + Number(x.total), 0);
  const anos = [ano + 1, ano, ano - 1].filter((a) => a <= new Date().getFullYear());

  return (
    <main className="max-w-3xl mx-auto px-5 py-8">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-widest" style={{ color: "var(--tinta-suave)" }}>
          Dados para declaração
        </p>
        <h1 className="text-2xl" style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}>
          {d.negocio?.nome ?? "Negócio"}
        </h1>
        <p className="text-sm" style={{ color: "var(--tinta-suave)" }}>
          {d.negocio?.cnpj ? `CNPJ ${d.negocio.cnpj}` : "CNPJ não informado"}
          {d.negocio?.municipio && ` · ${d.negocio.municipio}`}
          {d.negocio?.uf && `/${d.negocio.uf}`}
          {d.negocio?.data_abertura &&
            ` · aberto em ${formatarData(d.negocio.data_abertura)}`}
        </p>
      </header>

      <nav className="flex gap-2 mb-6 nao-imprimir" aria-label="Escolher ano">
        {anos.map((a) => (
          <a
            key={a}
            href={`?ano=${a}`}
            aria-current={a === ano ? "page" : undefined}
            className="text-sm px-3 py-1.5 rounded-full border"
            style={{
              borderColor: a === ano ? "var(--tinta)" : "var(--borda)",
              background: a === ano ? "var(--tinta)" : "transparent",
              color: a === ano ? "#fff" : "var(--tinta-suave)",
            }}
          >
            {a}
          </a>
        ))}
      </nav>

      {/* A divisão que a DASN-SIMEI pede, pronta para transcrever. */}
      <section
        className="rounded-lg border px-5 py-5 mb-6"
        style={{ borderColor: "var(--borda)", background: "#fff" }}
      >
        <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--tinta-suave)" }}>
          Receita bruta de {ano}
        </p>
        <p className="valor text-3xl mb-4" style={{ color: "var(--positivo)" }}>
          {formatarMoeda(Number(d.receita.total))}
        </p>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <dt style={{ color: "var(--tinta-suave)" }}>Comércio e indústria</dt>
            <dd className="valor">{formatarMoeda(Number(d.receita.comercio_industria))}</dd>
          </div>
          <div>
            <dt style={{ color: "var(--tinta-suave)" }}>Serviços</dt>
            <dd className="valor">{formatarMoeda(Number(d.receita.servicos))}</dd>
          </div>
        </dl>
        <p className="dica mt-3">
          Só recibos com pagamento recebido. Orçamentos e cobranças em aberto
          não entram.
        </p>
      </section>

      {d.por_mes.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold mb-2">Mês a mês</h2>
          <div
            className="rounded-lg border overflow-x-auto"
            style={{ borderColor: "var(--borda)", background: "#fff" }}
          >
            <table className="w-full text-sm" style={{ minWidth: "28rem" }}>
              <thead>
                <tr>
                  <th className="text-left px-4 py-2 font-medium" style={{ color: "var(--tinta-suave)" }}>
                    Mês
                  </th>
                  <th className="text-right px-4 py-2 font-medium" style={{ color: "var(--tinta-suave)" }}>
                    Comércio
                  </th>
                  <th className="text-right px-4 py-2 font-medium" style={{ color: "var(--tinta-suave)" }}>
                    Serviços
                  </th>
                  <th className="text-right px-4 py-2 font-medium" style={{ color: "var(--tinta-suave)" }}>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {d.por_mes.map((m) => (
                  <tr key={m.mes} className="border-t" style={{ borderColor: "var(--borda)" }}>
                    <td className="px-4 py-2 primeira-maiuscula">{rotuloMes(m.mes)}</td>
                    <td className="px-4 py-2 text-right valor">
                      {formatarMoeda(Number(m.comercio_industria))}
                    </td>
                    <td className="px-4 py-2 text-right valor">
                      {formatarMoeda(Number(m.servicos))}
                    </td>
                    <td className="px-4 py-2 text-right valor font-semibold">
                      {formatarMoeda(Number(m.total))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {d.despesas.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold mb-2">Custos do negócio em {ano}</h2>
          <div
            className="rounded-lg border divide-y"
            style={{ borderColor: "var(--borda)", background: "#fff" }}
          >
            {d.despesas.map((x) => (
              <div key={x.categoria} className="px-4 py-2 flex justify-between text-sm">
                <span>{x.categoria}</span>
                <span className="valor" style={{ color: "var(--selo)" }}>
                  {formatarMoeda(Number(x.total))}
                </span>
              </div>
            ))}
            <div className="px-4 py-2 flex justify-between text-sm font-semibold">
              <span>Total</span>
              <span className="valor">{formatarMoeda(totalDespesas)}</span>
            </div>
          </div>
          <p className="dica">
            Informativo. Retirada do dono não entra — não é despesa da empresa.
          </p>
        </section>
      )}

      <section className="mb-6">
        <h2 className="text-sm font-semibold mb-2">
          {d.documentos.length} recibo(s) recebido(s) em {ano}
        </h2>
        <div
          className="rounded-lg border divide-y"
          style={{ borderColor: "var(--borda)", background: "#fff" }}
        >
          {d.documentos.length === 0 ? (
            <p className="px-4 py-4 text-sm" style={{ color: "var(--tinta-suave)" }}>
              Nenhum recibo recebido neste ano.
            </p>
          ) : (
            d.documentos.map((doc) => (
              <div key={doc.numero} className="px-4 py-3 flex flex-wrap justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate">
                    #{doc.numero} · {doc.descricao}
                  </p>
                  <p className="text-xs" style={{ color: "var(--tinta-suave)" }}>
                    {formatarData(doc.data)} ·{" "}
                    {doc.natureza === "produto" ? "Comércio" : "Serviço"}
                    {doc.cliente && ` · ${doc.cliente}`}
                    {doc.documento_cliente &&
                      ` (${formatarDocumento(doc.documento_cliente)})`}
                    {doc.nf_numero && ` · NF ${doc.nf_numero}`}
                  </p>
                </div>
                <span className="valor shrink-0">{formatarMoeda(Number(doc.valor))}</span>
              </div>
            ))
          )}
        </div>
      </section>

      <footer
        className="text-xs border-t pt-4"
        style={{ borderColor: "var(--borda)", color: "var(--tinta-suave)" }}
      >
        <p>
          Acesso somente leitura, gerado pelo titular no AgilizeMei. Válido até{" "}
          {formatarData(d.expira_em.slice(0, 10))} — depois disso, peça um link
          novo a ele.
        </p>
        <p className="mt-1">
          Estes números vêm do controle do próprio MEI e não substituem
          conferência com extrato bancário e notas emitidas.
        </p>
      </footer>
    </main>
  );
}
