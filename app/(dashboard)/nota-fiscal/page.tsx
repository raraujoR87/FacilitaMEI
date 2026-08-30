import { AlertTriangle, ExternalLink } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { formatarData, formatarMoeda, hoje } from "@/lib/formato";
import {
  diasParaEmissorNacional,
  formatarDocumento,
  PORTAL_EMISSOR_NACIONAL,
  PORTAL_NFSE,
  situacaoFiscal,
  type Natureza,
} from "@/lib/fiscal";
import { Recibo, Vazio } from "@/components/ui/campos";
import { RegistrarNota } from "./registrar-nota";

type Documento = {
  id: string;
  numero: number;
  natureza: Natureza;
  descricao_servico: string;
  valor: number;
  data_emissao: string;
  nf_numero: string | null;
  clientes: { nome: string; documento: string | null } | { nome: string; documento: string | null }[] | null;
};

export default async function NotaFiscalPage() {
  const { supabase, user } = await exigirUsuario();

  const { data } = await supabase
    .from("documentos_venda")
    .select(
      "id, numero, natureza, descricao_servico, valor, data_emissao, nf_numero, clientes(nome, documento)"
    )
    .eq("user_id", user.id)
    .eq("tipo", "recibo")
    .neq("status", "cancelado")
    .order("data_emissao", { ascending: false })
    .limit(200);

  const documentos = (data ?? []) as Documento[];

  const comSituacao = documentos.map((d) => {
    const cliente = Array.isArray(d.clientes) ? d.clientes[0] : d.clientes;
    return { doc: d, cliente, fiscal: situacaoFiscal(d.natureza, cliente?.documento) };
  });

  const pendentes = comSituacao.filter((x) => x.fiscal.obrigatoria && !x.doc.nf_numero);
  const semDocumento = comSituacao.filter((x) => x.fiscal.documento === null);

  const dias = diasParaEmissorNacional(hoje());

  return (
    <div>
      <h1 className="text-2xl mb-1" style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}>
        Nota fiscal
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--tinta-suave)" }}>
        O AgilizeMei não emite a nota — quem emite é você, nos portais do
        governo. Aqui você vê quais entradas exigem nota e registra o número
        depois de emitir, para o relatório do contador bater.
      </p>

      {dias > 0 && (
        <div className="aviso mb-6" style={{ borderColor: "var(--pendente)", background: "rgba(217,164,65,0.10)" }}>
          <p className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: "var(--pendente)" }} aria-hidden />
            <span>
              <strong>Faltam {dias} dias.</strong> A partir de{" "}
              <strong>1º de novembro de 2026</strong>, quem é do Simples
              Nacional — MEI incluído — só pode emitir NFS-e pelo Emissor
              Nacional. Prazo definido pela Resolução CGSN nº 191, de 04/08/2026,
              que adiou a data original de 1º de setembro.
            </span>
          </p>
        </div>
      )}

      <Recibo titulo="Quando você precisa emitir" className="mb-6">
        <dl className="grid gap-4 sm:grid-cols-2 text-sm">
          <div>
            <dt className="font-medium">Cliente pessoa jurídica (CNPJ)</dt>
            <dd style={{ color: "var(--tinta-suave)" }}>
              Nota <strong>obrigatória</strong>. Serviço gera NFS-e; venda de
              produto gera NF-e, salvo se o comprador emitir nota de entrada.
            </dd>
          </div>
          <div>
            <dt className="font-medium">Cliente pessoa física (CPF)</dt>
            <dd style={{ color: "var(--tinta-suave)" }}>
              <strong>Dispensado.</strong> Você pode emitir se o cliente pedir,
              mas a lei não exige.
            </dd>
          </div>
        </dl>

        <p className="dica mt-4">
          Base: Lei Complementar 123/2006 e Resolução CGSN 140/2018. Regra
          fiscal muda — confirme com seu contador antes de decidir sobre um
          caso específico.
        </p>
      </Recibo>

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <OndeEmitir
          titulo="Serviço prestado → NFS-e"
          texto="Emissor Nacional da NFS-e, gratuito para MEI. Dá para emitir pelo portal ou pelo app NFS-e Mobile."
          link={PORTAL_EMISSOR_NACIONAL}
          rotuloLink="Abrir o Emissor Nacional"
        />
        <OndeEmitir
          titulo="Produto vendido → NF-e"
          texto="A NF-e de mercadoria é estadual: emitida no portal da SEFAZ do seu estado, que costuma exigir inscrição estadual e certificado digital."
          link={PORTAL_NFSE}
          rotuloLink="Portal nacional da NFS-e"
        />
      </div>

      <Recibo titulo={`Aguardando nota · ${pendentes.length}`} className="mb-6">
        {pendentes.length === 0 ? (
          <Vazio>Nenhuma entrada pendente de nota fiscal.</Vazio>
        ) : (
          <div className="flex flex-col divide-y" style={{ borderColor: "var(--borda)" }}>
            {pendentes.map(({ doc, cliente, fiscal }) => (
              <div key={doc.id} className="py-3 text-sm">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      #{doc.numero} · {doc.descricao_servico}
                    </p>
                    <p className="text-xs" style={{ color: "var(--tinta-suave)" }}>
                      {formatarData(doc.data_emissao)} · {cliente?.nome ?? "sem cliente"}
                      {cliente?.documento && ` · ${formatarDocumento(cliente.documento)}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="valor">{formatarMoeda(Number(doc.valor))}</span>
                    <p className="text-xs" style={{ color: "var(--selo)" }}>
                      {fiscal.documento}
                    </p>
                  </div>
                </div>
                <RegistrarNota id={doc.id} documento={fiscal.documento ?? "nota"} />
              </div>
            ))}
          </div>
        )}
      </Recibo>

      {semDocumento.length > 0 && (
        <Recibo titulo={`Sem CPF ou CNPJ do cliente · ${semDocumento.length}`}>
          <p className="dica mb-3">
            Sem o documento do cliente não dá para saber se a nota é
            obrigatória. Cadastre em Clientes para o aviso funcionar.
          </p>
          <div className="flex flex-col divide-y" style={{ borderColor: "var(--borda)" }}>
            {semDocumento.slice(0, 20).map(({ doc, cliente }) => (
              <div key={doc.id} className="flex justify-between gap-3 py-2 text-sm">
                <span className="truncate">
                  #{doc.numero} · {doc.descricao_servico}
                </span>
                <span className="shrink-0" style={{ color: "var(--tinta-suave)" }}>
                  {cliente?.nome ?? "sem cliente"}
                </span>
              </div>
            ))}
          </div>
        </Recibo>
      )}
    </div>
  );
}

function OndeEmitir({
  titulo,
  texto,
  link,
  rotuloLink,
}: {
  titulo: string;
  texto: string;
  link: string;
  rotuloLink: string;
}) {
  return (
    <section
      className="rounded-lg border px-5 py-5"
      style={{ borderColor: "var(--borda)", background: "#fff" }}
    >
      <h2 className="font-semibold mb-1">{titulo}</h2>
      <p className="text-sm mb-3" style={{ color: "var(--tinta-suave)" }}>
        {texto}
      </p>
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm inline-flex items-center gap-1.5 underline"
      >
        {rotuloLink}
        <ExternalLink size={13} aria-hidden />
      </a>
    </section>
  );
}
