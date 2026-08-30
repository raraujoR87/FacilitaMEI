import { exigirUsuario } from "@/lib/auth";
import { excluirLancamento } from "@/app/actions/lancamentos";
import {
  formatarData,
  formatarMoeda,
  intervaloDoMes,
  mesAtual,
} from "@/lib/formato";
import { Recibo, Vazio } from "@/components/ui/campos";
import { BotaoSubmit } from "@/components/ui/botao-submit";
import { SeletorMes } from "@/components/ui/seletor-mes";
import { FormularioLancamento } from "./formulario";
import { EnviarNota } from "./enviar-nota";

type Lancamento = {
  id: string;
  descricao: string;
  valor: number;
  tipo: "receita" | "despesa";
  data_competencia: string;
  fornecedor_cliente: string | null;
  origem: string;
  categorias: { nome: string } | { nome: string }[] | null;
};

function nomeCategoria(categorias: Lancamento["categorias"]): string | null {
  const c = Array.isArray(categorias) ? categorias[0] : categorias;
  return c?.nome ?? null;
}

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { supabase, user } = await exigirUsuario();
  const mes = (await searchParams).mes ?? mesAtual();
  const { inicio, fim } = intervaloDoMes(mes);

  const [{ data: lancamentos }, { data: categorias }] = await Promise.all([
    supabase
      .from("lancamentos")
      .select(
        "id, descricao, valor, tipo, data_competencia, fornecedor_cliente, origem, categorias(nome)"
      )
      .eq("user_id", user.id)
      .gte("data_competencia", inicio)
      .lte("data_competencia", fim)
      .order("data_competencia", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("categorias")
      .select("id, nome, tipo")
      .eq("user_id", user.id)
      .order("nome"),
  ]);

  const lista = (lancamentos ?? []) as Lancamento[];
  const receitas = lista
    .filter((l) => l.tipo === "receita")
    .reduce((soma, l) => soma + Number(l.valor), 0);
  const despesas = lista
    .filter((l) => l.tipo === "despesa")
    .reduce((soma, l) => soma + Number(l.valor), 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl" style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}>
          Financeiro
        </h1>
        <div className="flex items-center gap-3">
          <SeletorMes mes={mes} />
          <EnviarNota />
        </div>
      </div>

      <FormularioLancamento categorias={categorias ?? []} />

      <Recibo titulo={`Lançamentos · ${lista.length}`}>
        {lista.length === 0 ? (
          <Vazio>
            Nenhum lançamento neste mês. Use o formulário acima ou envie a foto
            de uma nota.
          </Vazio>
        ) : (
          <>
            <div className="flex flex-col divide-y" style={{ borderColor: "var(--borda)" }}>
              {lista.map((l) => (
                <div key={l.id} className="flex justify-between items-start gap-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{l.descricao}</p>
                    <p className="text-xs" style={{ color: "var(--tinta-suave)" }}>
                      {formatarData(l.data_competencia)}
                      {nomeCategoria(l.categorias) && ` · ${nomeCategoria(l.categorias)}`}
                      {l.fornecedor_cliente && ` · ${l.fornecedor_cliente}`}
                      {l.origem === "ocr" && " · lido da nota"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="valor"
                      style={{ color: l.tipo === "receita" ? "var(--positivo)" : "var(--selo)" }}
                    >
                      {l.tipo === "receita" ? "+" : "−"}
                      {formatarMoeda(Number(l.valor))}
                    </span>
                    <form action={excluirLancamento}>
                      <input type="hidden" name="id" value={l.id} />
                      <BotaoSubmit variante="discreto" carregando="...">
                        Excluir
                      </BotaoSubmit>
                    </form>
                  </div>
                </div>
              ))}
            </div>

            <div
              className="mt-4 pt-4 border-t border-dashed flex justify-between text-sm"
              style={{ borderColor: "var(--borda)" }}
            >
              <span style={{ color: "var(--tinta-suave)" }}>Saldo do mês</span>
              <span
                className="valor font-semibold"
                style={{ color: receitas - despesas >= 0 ? "var(--positivo)" : "var(--selo)" }}
              >
                {formatarMoeda(receitas - despesas)}
              </span>
            </div>
          </>
        )}
      </Recibo>
    </div>
  );
}
