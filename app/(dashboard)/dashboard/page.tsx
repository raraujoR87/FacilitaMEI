import Link from "next/link";
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

export default async function DashboardPage() {
  const { supabase, user } = await exigirUsuario();
  const mes = mesAtual();
  const { inicio, fim } = intervaloDoMes(mes);

  const [{ data: lancamentos }, { data: pendentes }] = await Promise.all([
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
      .select("valor, data_vencimento")
      .eq("user_id", user.id)
      .eq("status", "pendente"),
  ]);

  const lista = lancamentos ?? [];
  const receitas = lista
    .filter((l) => l.tipo === "receita")
    .reduce((soma, l) => soma + Number(l.valor), 0);
  const despesas = lista
    .filter((l) => l.tipo === "despesa")
    .reduce((soma, l) => soma + Number(l.valor), 0);

  const aReceber = (pendentes ?? []).reduce((soma, p) => soma + Number(p.valor), 0);
  const vencidas = (pendentes ?? []).filter((p) => estaVencido(p.data_vencimento)).length;

  return (
    <div>
      <h1 className="text-2xl" style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}>
        Visão geral
      </h1>
      <p className="text-sm mb-6 primeira-maiuscula" style={{ color: "var(--tinta-suave)" }}>
        {rotuloMes(mes)}
      </p>

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
            <Link href="/financeiro" className="underline font-medium">
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
                href="/financeiro"
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
