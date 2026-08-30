"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const ITENS_MENU = [
  { href: "/dashboard", label: "Visão geral" },
  { href: "/financeiro", label: "Financeiro" },
  { href: "/vendas", label: "Vendas" },
  { href: "/cobranca", label: "Cobrança" },
  { href: "/clientes", label: "Clientes" },
  { href: "/relatorio", label: "Relatório" },
  { href: "/configuracoes", label: "Configurações" },
];

export function Navegacao({ orientacao }: { orientacao: "lateral" | "topo" }) {
  const caminho = usePathname();

  if (orientacao === "topo") {
    return (
      <nav className="flex md:hidden border-b overflow-x-auto" style={{ borderColor: "var(--borda)" }}>
        {ITENS_MENU.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={caminho === item.href ? "page" : undefined}
            className="text-sm px-4 py-3 whitespace-nowrap"
            style={
              caminho === item.href
                ? { fontWeight: 600, boxShadow: "inset 0 -2px 0 var(--tinta)" }
                : { color: "var(--tinta-suave)" }
            }
          >
            {item.label}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav className="mt-8 hidden md:flex flex-col gap-0.5">
      {ITENS_MENU.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={caminho === item.href ? "page" : undefined}
          className="nav-item"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
