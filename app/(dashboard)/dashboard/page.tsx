import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import {
  estaVencido,
  formatarData,
  formatarMoeda,
  intervaloDoMes,
  mesAtual,
  rotuloMes,
} from "@/lib/formato";
import { Recibo, Vazio } from "@/components/ui/campos";
import { PainelTeto } from "@/components/ui/painel-teto";
import { situacaoTeto, tetoAplicavel, tetoDoAno } from "@/lib/mei";

export default async function DashboardPage() {
  const { supabase, user } = await exigirUsuario();
  const mes = mesAtual();
  const { inicio, fim } = intervaloDoMes(mes);

  const ano = Number(mes.slice(0, 4));

  const [{ data: lancamentos }, { data: pendentes }, { data: doAno }, { data: perfil }] =
    await Promise.all([
    supabase
      .from("lancamentos")
      .select("descricao, valor, tipo, data_competencia")
      .eq("user_id", user.id)
      .gte("data_competencia", inicio)
      .lte("data_competencia", fim)
      .order("data_competencia", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("documentos_venda")
      .select("id, numero, tipo, valor, data_vencimento, aceito_em, aceito_por")
      .eq("user_id", user.id)
      .eq("status", "pendente"),
    // Faturamento do ano inteiro: é o que o teto do MEI mede, não o mês.
    supabase
      .from("lancamentos")
      .select("valor")
      .eq("user_id", user.id)
      .eq("tipo", "receita")
      .gte("data_competencia", `${ano}-01-01`)
      .lte("data_competencia", `${ano}-12-31`),
    supabase
      .from("perfis")
      .select("data_abertura_mei")
      .eq("id", user.id)
      .single(),
  ]);

  const faturamentoAnual = (doAno ?? []).reduce((s, l) => s + Number(l.valor), 0);
  const teto = situacaoTeto(faturamentoAnual, ano, perfil?.data_abertura_mei);

  const lista = lancamentos ?? [];
  const receitas = lista
    .filter((l) => l.tipo === "receita")
    .reduce((soma, l) => soma + Number(l.valor), 0);
  const despesas = lista
    .filter((l) => l.tipo === "despesa")
    .reduce((soma, l) => soma + Number(l.valor), 0);

  // Orçamento é proposta, não dinheiro a receber: somá-lo aqui inflava o
  // valor com aquilo que ninguém se comprometeu a pagar.
  const cobrancas = (pendentes ?? []).filter((p) => p.tipo === "recibo");
  const aReceber = cobrancas.reduce((soma, p) => soma + Number(p.valor), 0);
  const vencidas = cobrancas.filter((p) => estaVencido(p.data_vencimento)).length;
  const orcamentosAceitos = (pendentes ?? []).filter(
    (p) => p.tipo === "orcamento" && p.aceito_em !== null
  );

  return (
    <div>
      <h1 className="text-2xl" style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}>
        Visão geral
      </h1>
      <p className="text-sm mb-6 primeira-maiuscula" style={{ color: "var(--tinta-suave)" }}>
        {rotuloMes(mes)}
      </p>

      {orcamentosAceitos.length > 0 && (
        <Link
          href="/cobranca"
          className="aviso aviso-sucesso mb-6 flex items-center gap-2"
          style={{ borderWidth: 2 }}
        >
          <CircleCheck size={16} className="shrink-0" aria-hidden />
          <span>
            {orcamentosAceitos.length === 1
              ? `${orcamentosAceitos[0].aceito_por} aceitou seu orçamento #${orcamentosAceitos[0].numero}. Emita o recibo →`
              : `${orcamentosAceitos.length} orçamentos foram aceitos pelos clientes. Ver e emitir os recibos →`}
          </span>
        </Link>
      )}

      <PainelTeto
        situacao={teto}
        ano={ano}
        proporcional={tetoAplicavel(ano, perfil?.data_abertura_mei) !== tetoDoAno(ano)}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Cartao label="Entradas" valor={receitas} cor="var(--positivo)" />
        <Cartao label="Saídas" valor={despesas} cor="var(--selo)" />
        <Cartao
          label="Saldo"
          valor={receitas - despesas}
          cor={receitas - despesas >= 0 ? "var(--tinta)" : "var(--selo)"}
        />
        <Cartao
          label="A receber"
          valor={aReceber}
          cor="var(--pendente)"
          href="/cobranca"
          nota={vencidas > 0 ? `${vencidas} vencida(s)` : undefined}
        />
      </div>

      <Recibo titulo="Últimos lançamentos">
        {lista.length === 0 ? (
          <Vazio>
            Nenhum lançamento este mês.{" "}
            <Link href="/movimento" className="underline font-medium">
              Lançar o primeiro
            </Link>
            .
          </Vazio>
        ) : (
          <>
            <div className="flex flex-col divide-y" style={{ borderColor: "var(--borda)" }}>
              {lista.slice(0, 8).map((l, i) => (
                <div key={i} className="flex justify-between items-start gap-4 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate">{l.descricao}</p>
                    <p className="text-xs" style={{ color: "var(--tinta-suave)" }}>
                      {formatarData(l.data_competencia)}
                    </p>
                  </div>
                  <span
                    className="valor"
                    style={{ color: l.tipo === "receita" ? "var(--positivo)" : "var(--selo)" }}
                  >
                    {l.tipo === "receita" ? "+" : "−"}
                    {formatarMoeda(Number(l.valor))}
                  </span>
                </div>
              ))}
            </div>
            {lista.length > 8 && (
              <Link
                href="/movimento"
                className="text-sm underline mt-4 inline-block"
                style={{ color: "var(--tinta-suave)" }}
              >
                Ver todos os {lista.length}
              </Link>
            )}
          </>
        )}
      </Recibo>
    </div>
  );
}

function Cartao({
  label,
  valor,
  cor,
  href,
  nota,
}: {
  label: string;
  valor: number;
  cor: string;
  href?: string;
  nota?: string;
}) {
  const conteudo = (
    <>
      <p className="text-xs" style={{ color: "var(--tinta-suave)" }}>
        {label}
      </p>
      <p className="valor text-lg mt-1" style={{ color: cor }}>
        {formatarMoeda(valor)}
      </p>
      {nota && (
        <p className="text-xs mt-0.5" style={{ color: "var(--selo)" }}>
          {nota}
        </p>
      )}
    </>
  );

  const classe = "rounded-lg border px-4 py-4 block";
  const estilo = { borderColor: "var(--borda)" };

  return href ? (
    <Link href={href} className={`${classe} hover:bg-black/[0.03]`} style={estilo}>
      {conteudo}
    </Link>
  ) : (
    <div className={classe} style={estilo}>
      {conteudo}
    </div>
  );
}
