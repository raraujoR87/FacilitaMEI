import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { formatarData, formatarMoeda } from "@/lib/formato";
import { formatarDocumento } from "@/lib/fiscal";
import { gerarBrCode, perfilTemPix, type TipoChavePix } from "@/lib/pix";
import { BotaoCopiar } from "@/components/ui/botao-copiar";
import { Marca } from "@/components/ui/marca";
import { AceitarOrcamento } from "./aceitar";

type Item = {
  descricao: string;
  quantidade: number;
  unidade: string;
  valor_unitario: number;
  total: number;
};

type Publico = {
  id: string;
  numero: number;
  tipo: "recibo" | "orcamento";
  natureza: "servico" | "produto";
  descricao_servico: string;
  valor: number;
  status: "pendente" | "pago" | "cancelado";
  data_emissao: string;
  data_vencimento: string | null;
  observacoes: string | null;
  aceito_em: string | null;
  aceito_por: string | null;
  cliente_nome: string | null;
  negocio_nome: string;
  negocio_cnpj: string | null;
  negocio_municipio: string | null;
  negocio_uf: string | null;
  logo_url: string | null;
  cor_marca: string | null;
  chave_pix: string | null;
  tipo_chave_pix: string | null;
  nome_titular_pix: string | null;
  cidade_pix: string | null;
  itens: Item[];
};

async function carregar(token: string): Promise<Publico | null> {
  // UUID malformado faria a função do banco estourar; melhor tratar como
  // link inexistente, que é o que ele é.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    return null;
  }

  const supabase = await createClient();
  const { data } = await supabase.rpc("documento_por_token", { token });
  const linha = Array.isArray(data) ? data[0] : data;
  return (linha as Publico) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const doc = await carregar((await params).token);
  if (!doc) return { title: "Documento não encontrado" };

  const titulo = doc.tipo === "recibo" ? "Recibo" : "Orçamento";
  return {
    title: `${titulo} nº ${doc.numero} — ${doc.negocio_nome}`,
    description: `${doc.descricao_servico} · ${formatarMoeda(Number(doc.valor))}`,
    // Link compartilhado por WhatsApp não deve acabar em busca do Google.
    robots: { index: false, follow: false },
  };
}

export default async function DocumentoPublicoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const doc = await carregar(token);

  if (!doc) notFound();

  const destaque = doc.cor_marca ?? "var(--positivo)";
  const titulo = doc.tipo === "recibo" ? "Recibo" : "Orçamento";
  const itens = doc.itens ?? [];

  const brcode =
    doc.status === "pendente" &&
    perfilTemPix({
      chave_pix: doc.chave_pix,
      tipo_chave_pix: doc.tipo_chave_pix,
      nome_titular_pix: doc.nome_titular_pix,
    })
      ? gerarBrCode({
          chave: doc.chave_pix!,
          tipoChave: doc.tipo_chave_pix as TipoChavePix,
          nomeTitular: doc.nome_titular_pix!,
          cidade: doc.cidade_pix ?? "",
          valor: Number(doc.valor),
          identificador: `AMEI${doc.numero}`,
        })
      : null;

  return (
    <main className="min-h-screen px-4 py-8">
      <article className="fita-recibo max-w-lg mx-auto px-6 py-8">
        <header className="text-center">
          {doc.logo_url && (
            // Logo do negócio, não do AgilizeMei: quem manda o link quer que
            // o cliente veja a marca dele.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={doc.logo_url}
              alt={doc.negocio_nome}
              className="max-h-16 mx-auto mb-3 object-contain"
            />
          )}
          <p style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}>
            {doc.negocio_nome}
          </p>
          {doc.negocio_cnpj && (
            <p className="text-xs" style={{ color: "var(--tinta-suave)" }}>
              CNPJ {formatarDocumento(doc.negocio_cnpj)}
            </p>
          )}
          {doc.negocio_municipio && (
            <p className="text-xs" style={{ color: "var(--tinta-suave)" }}>
              {doc.negocio_municipio}
              {doc.negocio_uf ? ` — ${doc.negocio_uf}` : ""}
            </p>
          )}

          <p
            className="text-xs uppercase tracking-widest mt-4"
            style={{ color: destaque, fontWeight: 700 }}
          >
            {titulo} nº {doc.numero}
          </p>
          <p className="text-xs" style={{ color: "var(--tinta-suave)" }}>
            {formatarData(doc.data_emissao)}
          </p>
        </header>

        <div className="my-5 border-t border-dashed" style={{ borderColor: "var(--borda)" }} />

        <section className="text-sm mb-4">
          {doc.cliente_nome && (
            <p>
              <span style={{ color: "var(--tinta-suave)" }}>Para: </span>
              {doc.cliente_nome}
            </p>
          )}
          <p>
            <span style={{ color: "var(--tinta-suave)" }}>Referente a: </span>
            {doc.descricao_servico}
          </p>
        </section>

        {itens.length > 0 && (
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: "var(--tinta-suave)" }}>
                  <th className="text-left font-medium pb-1">Item</th>
                  <th className="text-right font-medium pb-1">Qtd</th>
                  <th className="text-right font-medium pb-1">Total</th>
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
                      {formatarMoeda(Number(item.total))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-dashed pt-4 flex justify-between items-baseline" style={{ borderColor: "var(--borda)" }}>
          <span className="font-semibold">Total</span>
          <span className="valor text-2xl" style={{ color: destaque }}>
            {formatarMoeda(Number(doc.valor))}
          </span>
        </div>

        {doc.data_vencimento && doc.status === "pendente" && (
          <p className="dica text-right">Vence em {formatarData(doc.data_vencimento)}</p>
        )}

        {doc.observacoes && (
          <section className="mt-5 text-sm">
            <p className="text-xs uppercase tracking-widest" style={{ color: "var(--tinta-suave)" }}>
              Observações
            </p>
            <p className="whitespace-pre-line" style={{ color: "var(--tinta-suave)" }}>
              {doc.observacoes}
            </p>
          </section>
        )}

        {doc.status === "pago" && (
          <p className="mt-6 text-center">
            <span className="carimbo" style={{ color: "var(--positivo)" }}>
              pago
            </span>
          </p>
        )}

        {brcode && (
          <section className="mt-6">
            <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--tinta-suave)" }}>
              Pague por PIX
            </p>
            <code className="brcode block mb-2">{brcode}</code>
            <BotaoCopiar texto={brcode} rotulo="Copiar código PIX" />
            <p className="dica mt-1">
              Copie e cole no aplicativo do seu banco, em PIX copia e cola.
            </p>
          </section>
        )}

        {doc.tipo === "orcamento" && doc.status === "pendente" && (
          <AceitarOrcamento
            token={token}
            aceitoPor={doc.aceito_por}
            aceitoEm={doc.aceito_em}
          />
        )}
      </article>

      <p className="text-center mt-6 text-xs" style={{ color: "var(--tinta-suave)" }}>
        Documento emitido com <Marca tamanho="pequeno" />
      </p>
    </main>
  );
}
