import Link from "next/link";
import { CircleCheck, Clock, FileText, TriangleAlert } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { formatarData, formatarMoeda, hoje } from "@/lib/formato";
import {
  diasDeValidade,
  ROTULO_ORCAMENTO,
  situacaoDoOrcamento,
  type Orcamento,
  type SituacaoOrcamento,
} from "@/lib/orcamento";
import { combina } from "@/lib/busca";
import { Recibo, Vazio } from "@/components/ui/campos";
import { CampoBusca } from "@/components/ui/campo-busca";
import { FormularioOrcamento } from "./formulario";

type Linha = Orcamento & {
  clientes: { nome: string } | { nome: string }[] | null;
};

function nomeCliente(c: Linha["clientes"]): string | null {
  return (Array.isArray(c) ? c[0] : c)?.nome ?? null;
}

/**
 * Propostas, fora do Movimento.
 *
 * Orçamento não é dinheiro — é oferta. Enquanto morava dentro do
 * formulário de entrada, herdava campos que não são dele ("já recebi o
 * valor") e não tinha os que são: validade, condições de pagamento, prazo.
 */
export default async function OrcamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const termo = (await searchParams).q ?? "";
  const { supabase, user } = await exigirUsuario();

  const [{ data: documentos }, { data: clientes }] = await Promise.all([
    supabase
      .from("documentos_venda")
      .select(
        "id, numero, descricao_servico, valor, desconto, status, data_emissao, validade_em, aceito_em, aceito_por, token_publico, clientes(nome)"
      )
      .eq("user_id", user.id)
      .eq("tipo", "orcamento")
      .order("data_emissao", { ascending: false })
      .order("numero", { ascending: false }),
    supabase
      .from("clientes")
      .select("id, nome, documento")
      .eq("user_id", user.id)
      .is("arquivado_em", null)
      .order("nome"),
  ]);

  const hojeISO = hoje();
  const todos = (documentos ?? []) as Linha[];

  const comSituacao = todos.map((o) => ({
    o,
    situacao: situacaoDoOrcamento(o, hojeISO),
  }));

  const listados = comSituacao.filter(({ o }) =>
    combina(termo, o.descricao_servico, nomeCliente(o.clientes), `#${o.numero}`)
  );

  // Em aberto é o que ainda pode virar dinheiro. Convertido e cancelado
  // saíram do jogo; somá-los inflaria a expectativa.
  const emAberto = comSituacao.filter(
    (x) => x.situacao === "aguardando" || x.situacao === "aceito" || x.situacao === "rascunho"
  );
  const totalEmAberto = emAberto.reduce((s, x) => s + Number(x.o.valor), 0);
  const aceitos = comSituacao.filter((x) => x.situacao === "aceito");
  const vencendo = comSituacao.filter((x) => {
    if (x.situacao !== "aguardando") return false;
    const dias = diasDeValidade(x.o.validade_em, hojeISO);
    return dias !== null && dias <= 3;
  });

  return (
    <div>
      <h1 className="text-2xl mb-1" style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}>
        Orçamentos
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--tinta-suave)" }}>
        Propostas enviadas ao cliente. Só viram dinheiro quando ele aceita.
      </p>

      {todos.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          <Cartao rotulo="Em aberto" valor={formatarMoeda(totalEmAberto)} />
          <Cartao
            rotulo="Aceitos"
            valor={String(aceitos.length)}
            cor={aceitos.length > 0 ? "var(--positivo)" : undefined}
          />
          <Cartao
            rotulo="Vencendo"
            valor={String(vencendo.length)}
            cor={vencendo.length > 0 ? "var(--selo)" : undefined}
          />
        </div>
      )}

      {/* Aceite chega pelo link, sem passar por aqui: sem destaque, o MEI
          só descobre por acaso — e perde a venda pelo tempo de resposta. */}
      {aceitos.length > 0 && (
        <section className="mb-6">
          <h2
            className="text-sm font-semibold mb-2 flex items-center gap-1.5"
            style={{ color: "var(--positivo)" }}
          >
            <CircleCheck size={16} aria-hidden />
            {aceitos.length === 1
              ? "1 proposta aceita, esperando você"
              : `${aceitos.length} propostas aceitas, esperando você`}
          </h2>
          <div
            className="rounded-lg border-2 divide-y"
            style={{ borderColor: "var(--positivo)", background: "#fff" }}
          >
            {aceitos.map(({ o }) => (
              <Link
                key={o.id}
                href={`/orcamentos/${o.id}`}
                className="px-5 py-3 flex flex-wrap justify-between items-center gap-3 text-sm"
              >
                <span className="min-w-0">
                  <span className="font-medium underline">
                    #{o.numero} · {o.descricao_servico}
                  </span>
                  <span className="block text-xs" style={{ color: "var(--positivo)" }}>
                    aceito por {o.aceito_por} — falta incluir no movimento
                  </span>
                </span>
                <span className="valor shrink-0">{formatarMoeda(Number(o.valor))}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {vencendo.length > 0 && (
        <section className="mb-6">
          <h2
            className="text-sm font-semibold mb-2 flex items-center gap-1.5"
            style={{ color: "var(--selo)" }}
          >
            <TriangleAlert size={15} aria-hidden />
            {vencendo.length === 1
              ? "1 proposta vence em breve"
              : `${vencendo.length} propostas vencem em breve`}
          </h2>
          <div
            className="rounded-lg border divide-y"
            style={{ borderColor: "var(--selo)", background: "#fff" }}
          >
            {vencendo.map(({ o }) => {
              const dias = diasDeValidade(o.validade_em, hojeISO);
              return (
                <Link
                  key={o.id}
                  href={`/orcamentos/${o.id}`}
                  className="px-5 py-3 flex flex-wrap justify-between items-center gap-3 text-sm"
                >
                  <span className="min-w-0">
                    <span className="font-medium underline">
                      #{o.numero} · {o.descricao_servico}
                    </span>
                    <span className="block text-xs" style={{ color: "var(--tinta-suave)" }}>
                      {nomeCliente(o.clientes) ?? "sem cliente"} ·{" "}
                      {dias === 0 ? "vence hoje" : `vence em ${dias} dia${dias === 1 ? "" : "s"}`}
                    </span>
                  </span>
                  <span className="valor shrink-0">{formatarMoeda(Number(o.valor))}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <FormularioOrcamento clientes={clientes ?? []} />

      {todos.length > 0 && (
        <div className="mb-3">
          <CampoBusca
            placeholder="Buscar por título, cliente ou número"
            rotulo="Buscar orçamento"
          />
        </div>
      )}

      <Recibo
        titulo={
          termo
            ? `${listados.length} de ${todos.length} proposta(s)`
            : `${todos.length} proposta(s)`
        }
      >
        {listados.length === 0 ? (
          <Vazio>
            {termo
              ? `Nenhuma proposta encontrada para "${termo}".`
              : "Nenhuma proposta ainda. Crie uma, mande o link para o cliente e acompanhe o aceite por aqui."}
          </Vazio>
        ) : (
          <div className="flex flex-col divide-y" style={{ borderColor: "var(--borda)" }}>
            {listados.map(({ o, situacao }) => (
              <LinhaProposta
                key={o.id}
                orcamento={o}
                situacao={situacao}
                cliente={nomeCliente(o.clientes)}
                hojeISO={hojeISO}
              />
            ))}
          </div>
        )}
      </Recibo>
    </div>
  );
}

function LinhaProposta({
  orcamento,
  situacao,
  cliente,
  hojeISO,
}: {
  orcamento: Orcamento;
  situacao: SituacaoOrcamento;
  cliente: string | null;
  hojeISO: string;
}) {
  const rotulo = ROTULO_ORCAMENTO[situacao];
  const dias = diasDeValidade(orcamento.validade_em, hojeISO);

  return (
    <Link
      href={`/orcamentos/${orcamento.id}`}
      className="py-3 flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-start sm:gap-3 text-sm"
    >
      <div className="min-w-0 sm:flex-1">
        <p className="font-medium truncate">
          <FileText size={13} aria-hidden className="inline mr-1" />
          #{orcamento.numero} · {orcamento.descricao_servico}{" "}
          <span className="text-xs font-normal" style={{ color: rotulo.cor }}>
            · {rotulo.texto}
          </span>
        </p>
        <p className="text-xs" style={{ color: "var(--tinta-suave)" }}>
          {cliente ?? "sem cliente"} · emitida em {formatarData(orcamento.data_emissao)}
          {orcamento.validade_em &&
            situacao === "aguardando" &&
            dias !== null &&
            ` · ${dias === 0 ? "vence hoje" : `vale por mais ${dias} dia${dias === 1 ? "" : "s"}`}`}
          {situacao === "vencido" &&
            orcamento.validade_em &&
            ` · venceu em ${formatarData(orcamento.validade_em)}`}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {situacao === "aguardando" && (
          <Clock size={14} aria-hidden style={{ color: "var(--pendente)" }} />
        )}
        <span className="valor">{formatarMoeda(Number(orcamento.valor))}</span>
      </div>
    </Link>
  );
}

function Cartao({ rotulo, valor, cor }: { rotulo: string; valor: string; cor?: string }) {
  return (
    <div className="rounded-lg border px-3 py-3" style={{ borderColor: "var(--borda)" }}>
      <p className="text-xs" style={{ color: "var(--tinta-suave)" }}>
        {rotulo}
      </p>
      <p className="valor mt-0.5" style={{ color: cor ?? "var(--tinta)" }}>
        {valor}
      </p>
    </div>
  );
}
