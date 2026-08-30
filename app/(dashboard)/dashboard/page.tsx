import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const inicioDoMes = new Date();
  inicioDoMes.setDate(1);

  const { data: lancamentos } = user
    ? await supabase
        .from("lancamentos")
        .select("descricao, valor, tipo, data_competencia")
        .eq("user_id", user.id)
        .gte("data_competencia", inicioDoMes.toISOString().slice(0, 10))
        .order("data_competencia", { ascending: false })
        .limit(8)
    : { data: [] };

  const totalReceitas = (lancamentos ?? [])
    .filter((l) => l.tipo === "receita")
    .reduce((soma, l) => soma + Number(l.valor), 0);
  const totalDespesas = (lancamentos ?? [])
    .filter((l) => l.tipo === "despesa")
    .reduce((soma, l) => soma + Number(l.valor), 0);
  const saldo = totalReceitas - totalDespesas;

  return (
    <div>
      <h1
        className="text-2xl mb-6"
        style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}
      >
        Visão geral
      </h1>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <CardResumo label="Receitas do mês" valor={totalReceitas} cor="var(--positivo)" />
        <CardResumo label="Despesas do mês" valor={totalDespesas} cor="var(--selo)" />
        <CardResumo label="Saldo" valor={saldo} cor="var(--tinta)" />
      </div>

      <div className="fita-recibo px-6 py-6">
        <p className="text-xs uppercase tracking-widest mb-4" style={{ color: "var(--tinta-suave)" }}>
          Últimos lançamentos
        </p>
        {!lancamentos || lancamentos.length === 0 ? (
          <p className="text-sm py-6 text-center" style={{ color: "var(--tinta-suave)" }}>
            Nenhum lançamento ainda. Manda a foto de uma nota pelo WhatsApp
            pra começar.
          </p>
        ) : (
          <div className="flex flex-col divide-y" style={{ borderColor: "var(--borda)" }}>
            {lancamentos.map((l, i) => (
              <div key={i} className="flex justify-between py-2.5 text-sm">
                <div>
                  <p>{l.descricao}</p>
                  <p className="text-xs" style={{ color: "var(--tinta-suave)" }}>
                    {new Date(l.data_competencia).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <span
                  style={{
                    fontFamily: "var(--font-mono-valor)",
                    color: l.tipo === "receita" ? "var(--positivo)" : "var(--selo)",
                  }}
                >
                  {l.tipo === "receita" ? "+" : "-"}R${" "}
                  {Number(l.valor).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CardResumo({ label, valor, cor }: { label: string; valor: number; cor: string }) {
  return (
    <div className="rounded-lg border px-4 py-4" style={{ borderColor: "var(--borda)" }}>
      <p className="text-xs" style={{ color: "var(--tinta-suave)" }}>
        {label}
      </p>
      <p
        className="text-xl mt-1"
        style={{ fontFamily: "var(--font-mono-valor)", color: cor }}
      >
        R$ {valor.toFixed(2)}
      </p>
    </div>
  );
}
