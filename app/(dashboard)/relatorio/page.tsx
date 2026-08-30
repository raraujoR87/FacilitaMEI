import { exigirUsuario } from "@/lib/auth";
import {
  formatarData,
  formatarMoeda,
  intervaloDoMes,
  mesAtual,
  rotuloMes,
} from "@/lib/formato";
import { Recibo, Vazio } from "@/components/ui/campos";
import { SeletorMes } from "@/components/ui/seletor-mes";
import { BotaoImprimir } from "./botao-imprimir";

type Linha = {
  descricao: string;
  valor: number;
  tipo: "receita" | "despesa";
  data_competencia: string;
  fornecedor_cliente: string | null;
  categorias: { nome: string } | { nome: string }[] | null;
};

function nomeCategoria(categorias: Linha["categorias"]): string {
  const c = Array.isArray(categorias) ? categorias[0] : categorias;
  return c?.nome ?? "Sem categoria";
}

export default async function RelatorioPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { supabase, user } = await exigirUsuario();
  const mes = (await searchParams).mes ?? mesAtual();
  const { inicio, fim } = intervaloDoMes(mes);

  const [{ data: lancamentos }, { data: perfil }] = await Promise.all([
    supabase
      .from("lancamentos")
      .select(
        "descricao, valor, tipo, data_competencia, fornecedor_cliente, categorias(nome)"
      )
      .eq("user_id", user.id)
      .gte("data_competencia", inicio)
      .lte("data_competencia", fim)
      .order("data_competencia", { ascending: true }),
    supabase.from("perfis").select("nome_negocio, cnpj").eq("id", user.id).single(),
  ]);

  const lista = (lancamentos ?? []) as Linha[];
  const receitas = lista.filter((l) => l.tipo === "receita");
  const despesas = lista.filter((l) => l.tipo === "despesa");
  const somar = (ls: Linha[]) => ls.reduce((s, l) => s + Number(l.valor), 0);
  const totalReceitas = somar(receitas);
  const totalDespesas = somar(despesas);

  // Agrupamento por categoria: é o recorte que o contador pede primeiro.
  const porCategoria = new Map<string, { receita: number; despesa: number }>();
  for (const l of lista) {
    const chave = nomeCategoria(l.categorias);
    const atual = porCategoria.get(chave) ?? { receita: 0, despesa: 0 };
    atual[l.tipo] += Number(l.valor);
    porCategoria.set(chave, atual);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 nao-imprimir">
        <h1 className="text-2xl" style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}>
          Relatório
        </h1>
        <div className="flex items-center gap-3">
          <SeletorMes mes={mes} />
          <a
            href={`/api/relatorios/gerar?mes=${mes}&formato=csv`}
            className="botao botao-secundario"
            download
          >
            Baixar planilha
          </a>
          <BotaoImprimir />
        </div>
      </div>

      <Recibo className="mb-6">
        <div className="text-center mb-6">
          <p style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}>
            {perfil?.nome_negocio ?? "Meu negócio"}
          </p>
          {perfil?.cnpj && (
            <p className="text-xs" style={{ color: "var(--tinta-suave)" }}>
              CNPJ {perfil.cnpj}
            </p>
          )}
          <p className="text-xs uppercase tracking-widest mt-2" style={{ color: "var(--tinta-suave)" }}>
            Movimento de {rotuloMes(mes)}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs" style={{ color: "var(--tinta-suave)" }}>Entradas</p>
            <p className="valor text-lg" style={{ color: "var(--positivo)" }}>
              {formatarMoeda(totalReceitas)}
            </p>
          </div>
          <div>
            <p className="text-xs" style={{ color: "var(--tinta-suave)" }}>Saídas</p>
            <p className="valor text-lg" style={{ color: "var(--selo)" }}>
              {formatarMoeda(totalDespesas)}
            </p>
          </div>
          <div>
            <p className="text-xs" style={{ color: "var(--tinta-suave)" }}>Saldo</p>
            <p
              className="valor text-lg font-semibold"
              style={{ color: totalReceitas - totalDespesas >= 0 ? "var(--positivo)" : "var(--selo)" }}
            >
              {formatarMoeda(totalReceitas - totalDespesas)}
            </p>
          </div>
        </div>
      </Recibo>

      {porCategoria.size > 0 && (
        <Recibo titulo="Por categoria" className="mb-6">
          <div className="flex flex-col divide-y" style={{ borderColor: "var(--borda)" }}>
            {[...porCategoria.entries()]
              .sort((a, b) => b[1].despesa + b[1].receita - (a[1].despesa + a[1].receita))
              .map(([categoria, totais]) => (
                <div key={categoria} className="flex justify-between py-2 text-sm">
                  <span>{categoria}</span>
                  <span className="flex gap-4">
                    {totais.receita > 0 && (
                      <span className="valor" style={{ color: "var(--positivo)" }}>
                        +{formatarMoeda(totais.receita)}
                      </span>
                    )}
                    {totais.despesa > 0 && (
                      <span className="valor" style={{ color: "var(--selo)" }}>
                        −{formatarMoeda(totais.despesa)}
                      </span>
                    )}
                  </span>
                </div>
              ))}
          </div>
        </Recibo>
      )}

      <Recibo titulo={`Lançamentos · ${lista.length}`}>
        {lista.length === 0 ? (
          <Vazio>Nenhum lançamento em {rotuloMes(mes)}.</Vazio>
        ) : (
          <div className="flex flex-col divide-y" style={{ borderColor: "var(--borda)" }}>
            {lista.map((l, i) => (
              <div key={i} className="flex justify-between items-start gap-4 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate">{l.descricao}</p>
                  <p className="text-xs" style={{ color: "var(--tinta-suave)" }}>
                    {formatarData(l.data_competencia)} · {nomeCategoria(l.categorias)}
                    {l.fornecedor_cliente && ` · ${l.fornecedor_cliente}`}
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
        )}
      </Recibo>
    </div>
  );
}
