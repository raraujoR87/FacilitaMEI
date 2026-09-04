import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // `/redefinir-senha` fica de fora de propósito: o link do e-mail cria
  // sessão antes de a pessoa chegar lá, e tratá-la como tela de visitante
  // jogaria quem veio redefinir direto no dashboard, sem trocar a senha.
  const isAuthRoute =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/cadastro") ||
    request.nextUrl.pathname.startsWith("/esqueci-senha");
  const ROTAS_PROTEGIDAS = [
    "/dashboard",
    "/financeiro",
    "/movimento",
    "/nota-fiscal",
    "/recibo",
    "/vendas",
    "/cobranca",
    "/clientes",
    "/relatorio",
    "/configuracoes",
    "/planos",
    // O back-office também exige sessão; se é administrador, quem decide é
    // o banco — aqui só barramos visitante anônimo.
    "/admin",
  ];
  const isProtectedRoute = ROTAS_PROTEGIDAS.some((rota) =>
    request.nextUrl.pathname.startsWith(rota)
  );

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
