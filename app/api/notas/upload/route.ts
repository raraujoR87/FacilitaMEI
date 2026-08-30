import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extrairNota, NotaIlegivelError } from "@/lib/ocr";
import { hoje } from "@/lib/formato";

const TAMANHO_MAXIMO = 10 * 1024 * 1024; // 10 MB — foto de celular cabe folgado

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const formData = await request.formData();
  const arquivo = formData.get("arquivo");

  if (!(arquivo instanceof File)) {
    return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
  }
  if (arquivo.size === 0) {
    return NextResponse.json({ error: "O arquivo está vazio." }, { status: 400 });
  }
  if (arquivo.size > TAMANHO_MAXIMO) {
    return NextResponse.json(
      { error: "Arquivo muito grande. Envie uma foto de até 10 MB." },
      { status: 413 }
    );
  }

  // O limite do plano é checado antes da chamada de IA — é ela que custa.
  const { data: perfil } = await supabase
    .from("perfis")
    .select("plano, limite_notas_mes")
    .eq("id", user.id)
    .single();

  if (perfil?.plano === "free") {
    const { count } = await supabase
      .from("lancamentos")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .in("origem", ["upload", "ocr", "whatsapp"])
      .gte("created_at", `${hoje().slice(0, 7)}-01T00:00:00Z`);

    if ((count ?? 0) >= (perfil.limite_notas_mes ?? 10)) {
      return NextResponse.json(
        {
          error:
            "Você usou as notas do plano grátis deste mês. Continue lançando manualmente ou faça upgrade.",
        },
        { status: 402 }
      );
    }
  }

  const bytes = Buffer.from(await arquivo.arrayBuffer());
  const mediaType = arquivo.type || "image/jpeg";

  let extraido;
  let provedor;
  try {
    ({ nota: extraido, provedor } = await extrairNota(bytes, mediaType));
  } catch (erro) {
    if (erro instanceof NotaIlegivelError) {
      return NextResponse.json({ error: erro.message }, { status: 422 });
    }
    console.error("Falha na extração da nota:", erro);
    return NextResponse.json(
      { error: "O leitor de notas está indisponível. Lance manualmente por enquanto." },
      { status: 502 }
    );
  }

  // A primeira pasta é o id do usuário — é o que as policies do Storage usam
  // para isolar os comprovantes de cada conta.
  const nomeSeguro = arquivo.name.replace(/[^\w.-]/g, "_").slice(-60);
  const caminho = `${user.id}/${Date.now()}-${nomeSeguro}`;

  const { data: enviado } = await supabase.storage
    .from("comprovantes")
    .upload(caminho, bytes, { contentType: mediaType });

  const categoriaId = await encontrarOuCriarCategoria(
    supabase,
    user.id,
    extraido.categoria_sugerida,
    extraido.tipo
  );

  const { data: lancamento, error } = await supabase
    .from("lancamentos")
    .insert({
      user_id: user.id,
      categoria_id: categoriaId,
      tipo: extraido.tipo,
      descricao: extraido.descricao,
      valor: extraido.valor ?? 0,
      data_competencia: extraido.data_competencia,
      fornecedor_cliente: extraido.fornecedor_cliente,
      origem: "ocr",
      // O bucket é privado: aqui fica o caminho, e a URL assinada é gerada
      // na hora de exibir.
      url_comprovante: enviado?.path ?? null,
    })
    .select("id, descricao, valor, tipo, data_competencia")
    .single();

  if (error) {
    return NextResponse.json({ error: "Não foi possível salvar o lançamento." }, { status: 500 });
  }

  return NextResponse.json({ lancamento, confianca: extraido.confianca, provedor });
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function encontrarOuCriarCategoria(
  supabase: Supabase,
  userId: string,
  nome: string,
  tipo: "receita" | "despesa"
): Promise<string | null> {
  if (!nome) return null;

  const { data: existente } = await supabase
    .from("categorias")
    .select("id")
    .eq("user_id", userId)
    .eq("nome", nome)
    .maybeSingle();

  if (existente) return existente.id;

  const { data: nova } = await supabase
    .from("categorias")
    .insert({ user_id: userId, nome, tipo })
    .select("id")
    .single();

  return nova?.id ?? null;
}
