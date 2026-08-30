import Link from "next/link";
import { Briefcase, FileWarning, Package } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { excluirLancamento } from "@/app/actions/lancamentos";
import {
  formatarData,
  formatarMoeda,
  intervaloDoMes,
  mesAtual,
} from "@/lib/formato";
import { situacaoFiscal, type Natureza } from "@/lib/fiscal";
import { Recibo, Vazio } from "@/components/ui/campos";
import { BotaoSubmit } from "@/components/ui/botao-submit";
import { SeletorMes } from "@/components/ui/seletor-mes";
import { EnviarNota } from "./enviar-nota";
import { Formularios } from "./formularios";

type Um<T> = T | T[] | null;
function um<T>(v: Um<T>): T | null {
  return (Array.isArray(v) ? v[0] : v) ?? null;
}

type Linha = {
  id: string;
  descricao: string;
  valor: number;
  tipo: "receita" | "despesa";
  data_competencia: string;
  fornecedor_cliente: string | null;
  origem: string;
  categorias: Um<{ nome: string }>;
  documentos_venda: Um<{
    id: string;
    numero: number;
    natureza: Natureza;
    nf_numero: string | null;
    clientes: Um<{ nome: string; documento: string | null }>;
  }>;
};

const FILTROS = [
  { id: "tudo", rotulo: "Tudo" },
  { id: "servico", rotulo: "Serviços" },
  { id: "produto", rotulo: "Produtos" },
  { id: "saida", rotulo: "Saídas" },
  // Receitas lançadas antes de toda entrada passar a gerar recibo. Sem este
  // filtro elas só apareceriam em "Tudo" e ficariam invisíveis na prática.
  { id: "sem-recibo", rotulo: "Sem recibo" },
] as const;

type Filtro = (typeof FILTROS)[number]["id"];

export default async function MovimentoPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; filtro?: string }>;
}) {
  const { supabase, user } = await exigirUsuario();
  const params = await searchParams;
  const mes = params.mes ?? mesAtual();
  const filtro: Filtro =
    (FILTROS.find((f) => f.id === params.filtro)?.id as Filtro) ?? "tudo";
  const { inicio, fim } = intervaloDoMes(mes);

  const [{ data: lancamentos }, { data: clientes }, { data: categorias }] =
    await Promise.all([
      supabase
        .from("lancamentos")
        .select(
          "id, descricao, valor, tipo, data_competencia, fornecedor_cliente, origem, categorias(nome), documentos_venda(id, numero, natureza, nf_numero, clientes(nome, documento))"
        )
        .eq("user_id", user.id)
        .gte("data_competencia", inicio)
        .lte("data_competencia", fim)
        .order("data_competencia", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("clientes")
        .select("id, nome, documento")
        .eq("user_id", user.id)
        .order("nome"),
      supabase
        .from("categorias")
        .select("id, nome, tipo")
        .eq("user_id", user.id)
        .eq("tipo", "despesa")
        .order("nome"),
    ]);

  const todos = (lancamentos ?? []) as Linha[];

  const naturezaDe = (l: Linha): Natureza | null => um(l.documentos_venda)?.natureza ?? null;

  const semRecibo = todos.filter((l) => l.tipo === "receita" && !um(l.documentos_venda));

  const lista = todos.filter((l) => {
    if (filtro === "tudo") return true;
    if (filtro === "saida") return l.tipo === "despesa";
    if (filtro === "sem-recibo") return semRecibo.includes(l);
    return l.tipo === "receita" && naturezaDe(l) === filtro;
  });

  const somar = (ls: Linha[]) => ls.reduce((s, l) => s + Number(l.valor), 0);
  const servicos = somar(todos.filter((l) => naturezaDe(l) === "servico"));
  const produtos = somar(todos.filter((l) => naturezaDe(l) === "produto"));
  const receitas = somar(todos.filter((l) => l.tipo === "receita"));
  const saidas = somar(todos.filter((l) => l.tipo === "despesa"));
  const outrasEntradas = somar(semRecibo);

  // Entradas que exigem nota e ainda não têm número registrado.
  const semNota = todos.filter((l) => {
    const doc = um(l.documentos_venda);
    if (!doc || doc.nf_numero) return false;
    return situacaoFiscal(doc.natureza, um(doc.clientes)?.documento).obrigatoria;
  }).length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h1 className="text-2xl" style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}>
          Movimento
        </h1>
        <div className="flex items-center gap-3">
          <SeletorMes mes={mes} />
          <EnviarNota />
        </div>
      </div>

      {semNota > 0 && (
        <Link href="/nota-fiscal" className="aviso aviso-erro mb-5 flex items-center gap-2">
          <FileWarning size={16} aria-hidden />
          <span>
            {semNota} entrada{semNota > 1 ? "s exigem" : " exige"} nota fiscal e ainda
            não {semNota > 1 ? "foram emitidas" : "foi emitida"}. Ver o que fazer →
          </span>
        </Link>
      )}

      <Formularios clientes={clientes ?? []} categoriasDespesa={categorias ?? []} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Resumo rotulo="Serviços" valor={servicos} cor="var(--positivo)" Icone={Briefcase} />
        <Resumo rotulo="Produtos" valor={produtos} cor="var(--positivo)" Icone={Package} />
        <Resumo rotulo="Saídas" valor={saidas} cor="var(--selo)" />
        <Resumo
          rotulo="Saldo"
          valor={receitas - saidas}
          cor={receitas - saidas >= 0 ? "var(--tinta)" : "var(--selo)"}
        />
      </div>

      {outrasEntradas > 0 && (
        <p className="dica mb-4">
          {formatarMoeda(outrasEntradas)} em entradas sem recibo vinculado, de
          antes de toda entrada passar a gerar documento. Elas entram no saldo,
          mas não em Serviços nem em Produtos.
        </p>
      )}

      <nav className="flex gap-2 mb-4 overflow-x-auto" aria-label="Filtrar por tipo">
        {FILTROS.filter((f) => f.id !== "sem-recibo" || semRecibo.length > 0).map((f) => (
          <Link
            key={f.id}
            href={`/movimento?mes=${mes}&filtro=${f.id}`}
            aria-current={filtro === f.id ? "page" : undefined}
            className="text-sm px-3 py-1.5 rounded-full border whitespace-nowrap"
            style={{
              borderColor: filtro === f.id ? "var(--tinta)" : "var(--borda)",
              background: filtro === f.id ? "var(--tinta)" : "transparent",
              color: filtro === f.id ? "#fff" : "var(--tinta-suave)",
            }}
          >
            {f.rotulo}
          </Link>
        ))}
      </nav>

      <Recibo titulo={`${lista.length} registro${lista.length === 1 ? "" : "s"}`}>
        {lista.length === 0 ? (
          <Vazio>
            {filtro === "tudo"
              ? "Nada neste mês ainda. Use o formulário acima ou envie a foto de uma nota."
              : "Nenhum registro deste tipo no mês."}
          </Vazio>
        ) : (
          <div className="flex flex-col divide-y" style={{ borderColor: "var(--borda)" }}>
            {lista.map((l) => (
              <ItemMovimento key={l.id} linha={l} />
            ))}
          </div>
        )}
      </Recibo>
    </div>
  );
}

function ItemMovimento({ linha }: { linha: Linha }) {
  const doc = um(linha.documentos_venda);
  const cliente = doc ? um(doc.clientes) : null;
  const fiscal = doc ? situacaoFiscal(doc.natureza, cliente?.documento) : null;
  const receita = linha.tipo === "receita";

  return (
    <div className="flex justify-between items-start gap-3 py-3 text-sm">
      <div className="min-w-0">
        {doc ? (
          <Link href={`/recibo/${doc.id}`} className="font-medium truncate block underline">
            {linha.descricao}
          </Link>
        ) : (
          <p className="font-medium truncate">{linha.descricao}</p>
        )}
        <p className="text-xs" style={{ color: "var(--tinta-suave)" }}>
          {formatarData(linha.data_competencia)}
          {doc && ` · ${doc.natureza === "servico" ? "Serviço" : "Produto"}`}
          {um(linha.categorias) && ` · ${um(linha.categorias)!.nome}`}
          {linha.fornecedor_cliente && ` · ${linha.fornecedor_cliente}`}
          {linha.origem === "ocr" && " · lido da nota"}
          {receita && !doc && " · sem recibo"}
        </p>

        {fiscal?.obrigatoria && (
          <p className="text-xs mt-1" style={{ color: doc?.nf_numero ? "var(--positivo)" : "var(--selo)" }}>
            {doc?.nf_numero
              ? `${fiscal.documento} ${doc.nf_numero} emitida`
              : `${fiscal.documento} pendente`}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span
          className="valor"
          style={{ color: receita ? "var(--positivo)" : "var(--selo)" }}
        >
          {receita ? "+" : "−"}
          {formatarMoeda(Number(linha.valor))}
        </span>

        {/* Entrada não se apaga solta: ela pertence a um recibo numerado, e
            sumir com ela deixaria o documento sem contrapartida. */}
        {!doc && (
          <form action={excluirLancamento}>
            <input type="hidden" name="id" value={linha.id} />
            <BotaoSubmit variante="discreto" carregando="...">
              Excluir
            </BotaoSubmit>
          </form>
        )}
      </div>
    </div>
  );
}

function Resumo({
  rotulo,
  valor,
  cor,
  Icone,
}: {
  rotulo: string;
  valor: number;
  cor: string;
  Icone?: React.ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
}) {
  return (
    <div className="rounded-lg border px-3 py-3" style={{ borderColor: "var(--borda)" }}>
      <p className="text-xs flex items-center gap-1" style={{ color: "var(--tinta-suave)" }}>
        {Icone && <Icone size={12} aria-hidden />}
        {rotulo}
      </p>
      <p className="valor mt-0.5" style={{ color: cor }}>
        {formatarMoeda(valor)}
      </p>
    </div>
  );
}
