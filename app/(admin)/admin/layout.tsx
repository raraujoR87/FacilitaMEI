import Link from "next/link";
import { exigirAdministrador } from "@/lib/admin";
import { sair } from "@/app/actions/sessao";

const ABAS = [
  { href: "/admin", label: "Tenants" },
  { href: "/admin/problemas", label: "Problemas" },
  { href: "/admin/eventos", label: "Eventos" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Renderizar o back-office para quem não é operador seria vazamento por si
  // só — a lista de tenants é informação sensível mesmo sem os valores.
  const { user } = await exigirAdministrador();

  return (
    <div className="min-h-screen">
      {/* Barra escura: a mudança de contexto precisa ser óbvia à primeira
          vista, para ninguém confundir o painel de operação com o do cliente. */}
      <header style={{ background: "var(--tinta)", color: "var(--papel)" }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap items-center gap-x-6 gap-y-3">
          <span
            className="text-sm tracking-widest uppercase"
            style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}
          >
            AgilizeMei · Operação
          </span>

          <nav className="flex gap-1 flex-1">
            {ABAS.map((aba) => (
              <Link
                key={aba.href}
                href={aba.href}
                className="text-sm px-3 py-1.5 rounded-md hover:bg-white/10"
              >
                {aba.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-4 text-xs">
            <span style={{ opacity: 0.7 }}>{user.email}</span>
            <Link href="/dashboard" className="underline">
              Meu negócio
            </Link>
            <form action={sair}>
              <button type="submit" className="underline">
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
