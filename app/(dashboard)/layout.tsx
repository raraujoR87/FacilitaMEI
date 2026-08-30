import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { sair } from "@/app/actions/sessao";
import { NavegacaoInferior, NavegacaoLateral } from "@/components/ui/navegacao";
import { Marca } from "@/components/ui/marca";
import { AvisoTeste } from "@/components/ui/aviso-teste";
import { COLUNAS_PLANO, estaEmTeste, planoEfetivo } from "@/lib/planos";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: perfil }, { data: ehAdministrador }] = await Promise.all([
    user
      ? supabase
          .from("perfis")
          .select(`nome_negocio, ${COLUNAS_PLANO}`)
          .eq("id", user.id)
          .single()
      : Promise.resolve({ data: null }),
    // O link para a operação só existe para quem opera. Não é a proteção da
    // rota — essa está no banco —, é só não poluir a tela de quem não usa.
    supabase.rpc("eh_administrador"),
  ]);

  const nomeNegocio = perfil?.nome_negocio ?? "Meu negócio";

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Barra lateral: só no desktop. */}
      <aside
        className="hidden md:flex md:w-56 md:shrink-0 border-r px-5 py-6 flex-col md:min-h-screen justify-between nao-imprimir"
        style={{ borderColor: "var(--borda)" }}
      >
        <div>
          <Link href="/dashboard">
            <Marca />
          </Link>
          <NavegacaoLateral ehAdministrador={Boolean(ehAdministrador)} />
        </div>

        <div className="pt-6">
          <p
            className="text-xs truncate"
            style={{ color: "var(--tinta-suave)" }}
            title={nomeNegocio}
          >
            {nomeNegocio}
          </p>
          <Link
            href="/planos"
            className="text-xs underline"
            style={{ color: "var(--tinta-suave)" }}
          >
            {estaEmTeste(perfil)
              ? "Pro (teste)"
              : `Plano ${planoEfetivo(perfil) === "pro" ? "Pro" : "grátis"}`}
          </Link>
          <form action={sair} className="mt-2">
            <button type="submit" className="botao botao-discreto px-0">
              Sair
            </button>
          </form>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <AvisoTeste perfil={perfil} />

        {/* Cabeçalho compacto do celular, já que a lateral não existe lá. */}
        <header
          className="md:hidden flex items-center justify-between px-5 py-3 border-b nao-imprimir"
          style={{ borderColor: "var(--borda)", background: "var(--papel)" }}
        >
          <Link href="/dashboard">
            <Marca tamanho="pequeno" />
          </Link>
          <span
            className="text-xs truncate max-w-[50%]"
            style={{ color: "var(--tinta-suave)" }}
          >
            {nomeNegocio}
          </span>
        </header>

        {/* pb-24 no celular abre espaço para a barra fixa não cobrir conteúdo. */}
        <main className="px-5 md:px-6 py-6 md:py-8 pb-24 md:pb-8 max-w-4xl mx-auto">
          {children}
        </main>
      </div>

      <NavegacaoInferior ehAdministrador={Boolean(ehAdministrador)} sair={sair} />
    </div>
  );
}
