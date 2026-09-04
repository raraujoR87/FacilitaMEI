import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Entrada dos links enviados por e-mail (recuperação de senha, confirmação).
 *
 * Aceita as duas formas que o Supabase pode mandar, porque cada uma quebra
 * num cenário diferente:
 *
 * - `token_hash` + `type`: verificado direto, funciona mesmo quando o
 *   e-mail é aberto em outro aparelho — que é o caso comum, já que a
 *   pessoa pede a redefinição no computador e abre o link no celular.
 * - `code`: o fluxo PKCE padrão. Depende de um cookie gravado no navegador
 *   que PEDIU a redefinição, então só funciona no mesmo aparelho.
 *
 * Suportar as duas evita que a escolha do modelo de e-mail no painel do
 * Supabase deixe a recuperação quebrada sem ninguém perceber.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const tipo = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  // Só caminhos internos: `next` vem da URL e um valor absoluto viraria
  // redirecionamento aberto para fora do site.
  const proximo = searchParams.get("next") ?? "/dashboard";
  const destino = proximo.startsWith("/") && !proximo.startsWith("//")
    ? proximo
    : "/dashboard";

  const supabase = await createClient();

  if (tokenHash && tipo) {
    const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(destino, origin));
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(destino, origin));
  }

  // Link expirado ou já usado. Manda para o pedido de novo link com o
  // motivo, em vez de uma tela de erro sem saída.
  return NextResponse.redirect(new URL("/esqueci-senha?expirado=1", origin));
}
