import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const ITENS_MENU = [
  { href: "/dashboard", label: "Visão geral" },
  { href: "/financeiro", label: "Financeiro" },
  { href: "/vendas", label: "Vendas" },
  { href: "/cobranca", label: "Cobrança" },
];

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
    ? await supabase.from("perfis").select("nome_negocio").eq("id", user.id).single()
    : { data: null };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <aside
        className="md:w-56 border-b md:border-b-0 md:border-r px-5 py-6 flex md:flex-col justify-between"
        style={{ borderColor: "var(--borda)" }}
      >
        <div>
          <span
            className="text-lg tracking-tight"
            style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}
          >
            Facilita<span style={{ color: "var(--positivo)" }}>MEI</span>
          </span>
          <nav className="mt-8 hidden md:flex flex-col gap-1">
            {ITENS_MENU.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm px-3 py-2 rounded-md hover:bg-black/5"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="text-xs self-center md:self-auto" style={{ color: "var(--tinta-suave)" }}>
          {perfil?.nome_negocio ?? "Meu negócio"}
        </p>
      </aside>

      <div className="flex-1">
        {/* Navegação mobile simples */}
        <nav
          className="flex md:hidden border-b overflow-x-auto"
          style={{ borderColor: "var(--borda)" }}
        >
          {ITENS_MENU.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm px-4 py-3 whitespace-nowrap"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <main className="px-6 py-8 max-w-4xl mx-auto">{children}</main>
      </div>
    </div>
  );
}
