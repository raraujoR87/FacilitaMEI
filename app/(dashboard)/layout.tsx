import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { sair } from "@/app/actions/sessao";
import { Navegacao } from "@/components/ui/navegacao";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: perfil } = user
    ? await supabase
        .from("perfis")
        .select("nome_negocio, plano")
        .eq("id", user.id)
        .single()
    : { data: null };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <aside
        className="md:w-56 md:shrink-0 border-b md:border-b-0 md:border-r px-5 py-6 flex md:flex-col md:min-h-screen justify-between items-center md:items-stretch nao-imprimir"
        style={{ borderColor: "var(--borda)" }}
      >
        <div>
          <Link
            href="/dashboard"
            className="text-lg tracking-tight"
            style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}
          >
            Facilita<span style={{ color: "var(--positivo)" }}>MEI</span>
          </Link>
          <Navegacao orientacao="lateral" />
        </div>

        <div className="md:pt-6">
          <p
            className="text-xs truncate max-w-[12rem]"
            style={{ color: "var(--tinta-suave)" }}
            title={perfil?.nome_negocio ?? undefined}
          >
            {perfil?.nome_negocio ?? "Meu negócio"}
          </p>
          <p className="text-xs mb-2" style={{ color: "var(--tinta-suave)" }}>
            Plano {perfil?.plano === "pro" ? "Pro" : "grátis"}
          </p>
          <form action={sair}>
            <button type="submit" className="botao botao-discreto px-0">
              Sair
            </button>
          </form>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <div className="nao-imprimir">
          <Navegacao orientacao="topo" />
        </div>
        <main className="px-6 py-8 max-w-4xl mx-auto">{children}</main>
      </div>
    </div>
  );
}
