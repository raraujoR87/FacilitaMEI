import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { formatarData, intervaloDoMes } from "@/lib/formato";

type Linha = {
  descricao: string;
  valor: number;
  tipo: "receita" | "despesa";
  data_competencia: string;
  fornecedor_cliente: string | null;
  categorias: { nome: string } | { nome: string }[] | null;
};

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const mes = searchParams.get("mes");
  const formato = searchParams.get("formato") ?? "json";

  if (!mes || !/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) {
    return NextResponse.json(
      { error: "Parâmetro 'mes' obrigatório no formato YYYY-MM" },
      { status: 400 }
    );
  }

  const { inicio, fim } = intervaloDoMes(mes);

  const { data, error } = await supabase
    .from("lancamentos")
    .select(
      "descricao, valor, tipo, data_competencia, fornecedor_cliente, categorias(nome)"
    )
    .eq("user_id", user.id)
    .gte("data_competencia", inicio)
    .lte("data_competencia", fim)
    .order("data_competencia", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const lancamentos = (data ?? []) as Linha[];
  const somar = (tipo: string) =>
    lancamentos
      .filter((l) => l.tipo === tipo)
      .reduce((soma, l) => soma + Number(l.valor), 0);

  const totalReceitas = somar("receita");
  const totalDespesas = somar("despesa");

  if (formato === "csv") {
    return respostaCsv(mes, lancamentos, totalReceitas, totalDespesas);
  }

  return NextResponse.json({
    periodo: mes,
    total_receitas: totalReceitas,
    total_despesas: totalDespesas,
    saldo: totalReceitas - totalDespesas,
    lancamentos,
  });
}

function nomeCategoria(categorias: Linha["categorias"]): string {
  const c = Array.isArray(categorias) ? categorias[0] : categorias;
  return c?.nome ?? "Sem categoria";
}

/** Aspas duplas dentro de um campo CSV são escapadas dobrando-as. */
function celula(valor: string): string {
  return `"${valor.replace(/"/g, '""')}"`;
}

function respostaCsv(
  mes: string,
  lancamentos: Linha[],
  totalReceitas: number,
  totalDespesas: number
): NextResponse {
  const linhas = [
    ["Data", "Tipo", "Descrição", "Categoria", "Fornecedor/Cliente", "Valor"],
    ...lancamentos.map((l) => [
      formatarData(l.data_competencia),
      l.tipo === "receita" ? "Entrada" : "Saída",
      l.descricao,
      nomeCategoria(l.categorias),
      l.fornecedor_cliente ?? "",
      // Excel em pt-BR só entende o número como número com vírgula decimal.
      Number(l.valor).toFixed(2).replace(".", ","),
    ]),
    [],
    ["", "", "Total de entradas", "", "", totalReceitas.toFixed(2).replace(".", ",")],
    ["", "", "Total de saídas", "", "", totalDespesas.toFixed(2).replace(".", ",")],
    [
      "",
      "",
      "Saldo",
      "",
      "",
      (totalReceitas - totalDespesas).toFixed(2).replace(".", ","),
    ],
  ];

  // Separador ";" e BOM: sem os dois o Excel brasileiro joga tudo numa
  // coluna só e quebra os acentos.
  const csv =
    "\uFEFF" + linhas.map((linha) => linha.map(celula).join(";")).join("\r\n");

  const nomeArquivo = `agilizemei-${mes}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
      "Cache-Control": "no-store",
    },
  });
}
