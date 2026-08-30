import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { formatarData, intervaloDoMes } from "@/lib/formato";
import { repartirSaidas } from "@/lib/caixa";

type Linha = {
  descricao: string;
  valor: number;
  tipo: "receita" | "despesa";
  natureza_saida: string | null;
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
      "descricao, valor, tipo, natureza_saida, data_competencia, fornecedor_cliente, categorias(nome)"
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

  // Retirada não é despesa do negócio: é o resultado indo para o bolso do
  // dono. Somada junto, o saldo do mês saía menor do que foi de verdade —
  // e é este arquivo que vai para o contador.
  const { custos, retiradas, impostos } = repartirSaidas(lancamentos);
  const resultado = totalReceitas - custos - impostos;

  const totais = { totalReceitas, custos, impostos, retiradas, resultado };

  if (formato === "csv") {
    return respostaCsv(mes, lancamentos, totais);
  }

  return NextResponse.json({
    periodo: mes,
    total_receitas: totalReceitas,
    custos_do_negocio: custos,
    impostos,
    retiradas_do_dono: retiradas,
    resultado,
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

/** Excel em pt-BR só entende o número como número com vírgula decimal. */
function moeda(valor: number): string {
  return valor.toFixed(2).replace(".", ",");
}

const ROTULO_NATUREZA: Record<string, string> = {
  custo: "Custo do negócio",
  retirada: "Retirada do dono",
  imposto: "Imposto (DAS)",
};

function respostaCsv(
  mes: string,
  lancamentos: Linha[],
  totais: {
    totalReceitas: number;
    custos: number;
    impostos: number;
    retiradas: number;
    resultado: number;
  }
): NextResponse {
  const linhas = [
    ["Data", "Tipo", "Natureza", "Descrição", "Categoria", "Fornecedor/Cliente", "Valor"],
    ...lancamentos.map((l) => [
      formatarData(l.data_competencia),
      l.tipo === "receita" ? "Entrada" : "Saída",
      // A coluna que o contador precisa para não somar retirada como
      // despesa dedutível.
      l.natureza_saida ? ROTULO_NATUREZA[l.natureza_saida] ?? "" : "",
      l.descricao,
      nomeCategoria(l.categorias),
      l.fornecedor_cliente ?? "",
      moeda(Number(l.valor)),
    ]),
    [],
    ["", "", "", "Total de entradas", "", "", moeda(totais.totalReceitas)],
    ["", "", "", "Custos do negócio", "", "", moeda(totais.custos)],
    ["", "", "", "Imposto (DAS)", "", "", moeda(totais.impostos)],
    ["", "", "", "Resultado do mês", "", "", moeda(totais.resultado)],
    [],
    ["", "", "", "Retirada do dono", "", "", moeda(totais.retiradas)],
    [
      "",
      "",
      "",
      "(retirada não é despesa do negócio: é o resultado acima indo para o dono)",
      "",
      "",
      "",
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
