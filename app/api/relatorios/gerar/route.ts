import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const mes = searchParams.get("mes"); // formato "2026-08"

  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
    return NextResponse.json(
      { error: "Parâmetro 'mes' obrigatório no formato YYYY-MM" },
      { status: 400 }
    );
  }

  const inicio = `${mes}-01`;
  const [ano, mesNum] = mes.split("-").map(Number);
  const fim = new Date(ano, mesNum, 0).toISOString().slice(0, 10);

  const { data: lancamentos, error } = await supabase
    .from("lancamentos")
    .select("descricao, valor, tipo, data_competencia, fornecedor_cliente, categorias(nome)")
    .eq("user_id", user.id)
    .gte("data_competencia", inicio)
    .lte("data_competencia", fim)
    .order("data_competencia", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const totalReceitas = lancamentos
    .filter((l) => l.tipo === "receita")
    .reduce((soma, l) => soma + Number(l.valor), 0);

  const totalDespesas = lancamentos
    .filter((l) => l.tipo === "despesa")
    .reduce((soma, l) => soma + Number(l.valor), 0);

  return NextResponse.json({
    periodo: mes,
    total_receitas: totalReceitas,
    total_despesas: totalDespesas,
    saldo: totalReceitas - totalDespesas,
    lancamentos,
  });

  // Nota: geração de PDF/Excel formatado fica para uma segunda etapa
  // (ex: lib usando um pacote de geração de planilha no servidor).
  // Este endpoint já entrega os dados prontos para essa camada.
}
