import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hoje } from "@/lib/formato";

/**
 * Portabilidade (LGPD, art. 18, V): tudo o que temos sobre a conta, num
 * arquivo aberto, sem precisar pedir a ninguém.
 *
 * Vai em JSON porque preserva a estrutura — recibo com seus itens, cliente
 * com seus documentos. CSV achataria isso e o relatório mensal já cobre o
 * caso de quem quer abrir em planilha.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const [perfil, categorias, clientes, documentos, lancamentos] = await Promise.all([
    supabase.from("perfis").select("*").eq("id", user.id).single(),
    supabase.from("categorias").select("*").eq("user_id", user.id),
    supabase.from("clientes").select("*").eq("user_id", user.id),
    supabase
      .from("documentos_venda")
      .select("*, itens_documento(*)")
      .eq("user_id", user.id)
      .order("numero"),
    supabase
      .from("lancamentos")
      .select("*")
      .eq("user_id", user.id)
      .order("data_competencia"),
  ]);

  const conteudo = {
    exportado_em: new Date().toISOString(),
    conta: { id: user.id, email: user.email, criada_em: user.created_at },
    perfil: perfil.data,
    categorias: categorias.data ?? [],
    clientes: clientes.data ?? [],
    documentos_venda: documentos.data ?? [],
    lancamentos: lancamentos.data ?? [],
    observacao:
      "Comprovantes enviados como imagem não estão neste arquivo. Eles ficam no armazenamento e podem ser baixados pela tela de movimento.",
  };

  return new NextResponse(JSON.stringify(conteudo, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="agilizemei-${hoje()}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
