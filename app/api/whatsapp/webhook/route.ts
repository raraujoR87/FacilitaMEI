import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Cliente com service role — necessário aqui porque o webhook do WhatsApp
// não tem sessão de usuário autenticado; identificamos o tenant pelo
// telefone cadastrado em `perfis.telefone_whatsapp`.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Verificação do webhook (Meta WhatsApp Cloud API faz um GET de validação)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Token inválido" }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const payload = await request.json();

  // Estrutura simplificada do payload da Meta Cloud API.
  // Adapte conforme o provedor escolhido (Meta oficial, Z-API, Twilio etc).
  const entrada = payload?.entry?.[0]?.changes?.[0]?.value;
  const mensagem = entrada?.messages?.[0];
  const telefoneRemetente: string | undefined = mensagem?.from;

  if (!mensagem || !telefoneRemetente) {
    return NextResponse.json({ ok: true }); // evento sem mensagem relevante
  }

  const { data: perfil } = await supabaseAdmin
    .from("perfis")
    .select("id")
    .eq("telefone_whatsapp", telefoneRemetente)
    .maybeSingle();

  if (!perfil) {
    // Número não cadastrado — poderia disparar uma mensagem de boas-vindas
    // com instrução de como vincular o WhatsApp na conta.
    return NextResponse.json({ ok: true });
  }

  if (mensagem.type === "image") {
    // TODO: baixar a mídia via Media API do WhatsApp usando mensagem.image.id,
    // depois reencaminhar para a mesma lógica de extração usada em
    // /api/notas/upload (fatorar a extração da IA em lib/ocr.ts).
  } else if (mensagem.type === "text") {
    const texto: string = mensagem.text?.body ?? "";
    if (/saldo/i.test(texto)) {
      // TODO: consultar lancamentos do mês e responder via API de envio
      // de mensagens do WhatsApp com o saldo atual.
    }
  }

  return NextResponse.json({ ok: true });
}
