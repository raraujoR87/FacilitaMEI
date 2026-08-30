import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic();

const PROMPT_EXTRACAO = `Você recebe a imagem de uma nota fiscal, recibo ou boleto brasileiro.
Extraia as informações e responda SOMENTE com um JSON no formato exato abaixo,
sem markdown, sem texto adicional:

{
  "descricao": "string curta descrevendo a compra/serviço",
  "valor": number,
  "data_competencia": "YYYY-MM-DD",
  "fornecedor_cliente": "string com o nome do fornecedor/emissor",
  "tipo": "despesa" ou "receita",
  "categoria_sugerida": "string com uma categoria comum (ex: Alimentação, Transporte, Fornecedores, Impostos, Serviços, Material de Escritório, Outros)"
}

Se não conseguir identificar a data, use a data de hoje. Se não conseguir
identificar o valor com clareza, retorne valor como null.`;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  // Verifica limite do plano antes de gastar chamada de IA
  const { data: perfil } = await supabase
    .from("perfis")
    .select("plano, limite_notas_mes")
    .eq("id", user.id)
    .single();

  const inicioDoMes = new Date();
  inicioDoMes.setDate(1);
  inicioDoMes.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from("lancamentos")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .in("origem", ["upload", "ocr", "whatsapp"])
    .gte("created_at", inicioDoMes.toISOString());

  if (perfil?.plano === "free" && (count ?? 0) >= (perfil?.limite_notas_mes ?? 10)) {
    return NextResponse.json(
      { error: "Limite de notas do plano gratuito atingido este mês. Faça upgrade para continuar." },
      { status: 402 }
    );
  }

  const formData = await request.formData();
  const arquivo = formData.get("arquivo") as File | null;

  if (!arquivo) {
    return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
  }

  const bytes = Buffer.from(await arquivo.arrayBuffer());
  const base64 = bytes.toString("base64");
  const mediaType = arquivo.type || "image/jpeg";

  // Upload do comprovante original para o Storage
  const caminhoArquivo = `${user.id}/${Date.now()}-${arquivo.name}`;
  const { data: uploadData } = await supabase.storage
    .from("comprovantes")
    .upload(caminhoArquivo, bytes, { contentType: mediaType });

  const urlComprovante = uploadData
    ? supabase.storage.from("comprovantes").getPublicUrl(uploadData.path).data.publicUrl
    : null;

  // Extração via IA
  const resposta = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType as "image/jpeg" | "image/png" | "image/webp",
              data: base64,
            },
          },
          { type: "text", text: PROMPT_EXTRACAO },
        ],
      },
    ],
  });

  const textoResposta = resposta.content.find((b) => b.type === "text")?.text ?? "{}";
  let extraido;
  try {
    extraido = JSON.parse(textoResposta.replace(/```json|```/g, "").trim());
  } catch {
    return NextResponse.json(
      { error: "Não foi possível interpretar a nota. Tente uma foto mais nítida." },
      { status: 422 }
    );
  }

  // Busca ou cria a categoria sugerida
  let categoriaId: string | null = null;
  if (extraido.categoria_sugerida) {
    const { data: categoriaExistente } = await supabase
      .from("categorias")
      .select("id")
      .eq("user_id", user.id)
      .eq("nome", extraido.categoria_sugerida)
      .maybeSingle();

    if (categoriaExistente) {
      categoriaId = categoriaExistente.id;
    } else {
      const { data: novaCategoria } = await supabase
        .from("categorias")
        .insert({
          user_id: user.id,
          nome: extraido.categoria_sugerida,
          tipo: extraido.tipo === "receita" ? "receita" : "despesa",
        })
        .select("id")
        .single();
      categoriaId = novaCategoria?.id ?? null;
    }
  }

  const { data: lancamento, error } = await supabase
    .from("lancamentos")
    .insert({
      user_id: user.id,
      categoria_id: categoriaId,
      tipo: extraido.tipo === "receita" ? "receita" : "despesa",
      descricao: extraido.descricao ?? "Lançamento sem descrição",
      valor: extraido.valor ?? 0,
      data_competencia: extraido.data_competencia ?? new Date().toISOString().slice(0, 10),
      fornecedor_cliente: extraido.fornecedor_cliente ?? null,
      origem: "ocr",
      url_comprovante: urlComprovante,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ lancamento });
}
