"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ChartColumn,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";

type Item = { href: string; label: string; curto: string; Icone: LucideIcon };

/**
 * Os quatro primeiros são o trabalho do dia a dia e ficam na barra inferior
 * do celular. O resto entra na gaveta "Mais" — cabem cinco alvos por linha
 * antes de os toques começarem a errar.
 */
export const ITENS_PRINCIPAIS: Item[] = [
  { href: "/dashboard", label: "Visão geral", curto: "Início", Icone: LayoutDashboard },
  { href: "/movimento", label: "Movimento", curto: "Movimento", Icone: Wallet },
  { href: "/cobranca", label: "A receber", curto: "Receber", Icone: HandCoins },
  { href: "/nota-fiscal", label: "Nota fiscal", curto: "Notas", Icone: Receipt },
];

export const ITENS_SECUNDARIOS: Item[] = [
  { href: "/clientes", label: "Clientes", curto: "Clientes", Icone: Users },
  { href: "/relatorio", label: "Relatório", curto: "Relatório", Icone: ChartColumn },
  { href: "/planos", label: "Plano e cobrança", curto: "Plano", Icone: Sparkles },
  { href: "/configuracoes", label: "Configurações", curto: "Ajustes", Icone: Settings },
];

function estaAtivo(caminho: string, href: string): boolean {
  return caminho === href || caminho.startsWith(`${href}/`);
}

/** Barra lateral do desktop. */
export function NavegacaoLateral({ ehAdministrador }: { ehAdministrador?: boolean }) {
  const caminho = usePathname();
  const itens = [...ITENS_PRINCIPAIS, ...ITENS_SECUNDARIOS];

  return (
    <nav className="mt-8 hidden md:flex flex-col gap-0.5">
      {itens.map(({ href, label, Icone }) => (
        <Link
          key={href}
          href={href}
          aria-current={estaAtivo(caminho, href) ? "page" : undefined}
          className="nav-item flex items-center gap-2.5"
        >
          <Icone size={17} strokeWidth={2} aria-hidden />
          <span>{label}</span>
        </Link>
      ))}

      {ehAdministrador && (
        <Link
          href="/admin"
          aria-current={estaAtivo(caminho, "/admin") ? "page" : undefined}
          className="nav-item flex items-center gap-2.5 mt-2"
          style={{ color: "var(--tinta-suave)" }}
        >
          <ShieldCheck size={17} strokeWidth={2} aria-hidden />
          <span>Operação</span>
        </Link>
      )}
    </nav>
  );
}

/**
 * Barra inferior do celular.
 *
 * Fica fixa no rodapé porque é onde o polegar alcança sem reposicionar o
 * aparelho — o MEI usa isso de pé, no balcão, com uma mão só.
 */
export function NavegacaoInferior({
  ehAdministrador,
  sair,
}: {
  ehAdministrador?: boolean;
  sair: () => Promise<void>;
}) {
  const caminho = usePathname();
  const [gavetaAberta, setGavetaAberta] = useState(false);
  const fechar = () => setGavetaAberta(false);

  const algumSecundarioAtivo = ITENS_SECUNDARIOS.some((i) => estaAtivo(caminho, i.href));

  return (
    <>
      {gavetaAberta && (
        <div
          className="md:hidden fixed inset-0 z-40 nao-imprimir"
          style={{ background: "rgba(26,26,26,0.35)" }}
          onClick={fechar}
          aria-hidden
        />
      )}

      {gavetaAberta && (
        <div
          className="md:hidden fixed left-0 right-0 bottom-0 z-50 rounded-t-2xl px-5 pt-4 pb-24 nao-imprimir"
          style={{ background: "#fff", borderTop: "1px solid var(--borda)" }}
          role="dialog"
          aria-label="Mais opções"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-widest" style={{ color: "var(--tinta-suave)" }}>
              Mais
            </span>
            <button
              type="button"
              onClick={fechar}
              aria-label="Fechar"
              className="p-1"
            >
              <X size={18} aria-hidden />
            </button>
          </div>

          <div className="grid gap-1">
            {ITENS_SECUNDARIOS.map(({ href, label, Icone }) => (
              <Link
                key={href}
                href={href}
                aria-current={estaAtivo(caminho, href) ? "page" : undefined}
                onClick={fechar}
                className="nav-item flex items-center gap-3 py-3"
              >
                <Icone size={19} aria-hidden />
                <span>{label}</span>
              </Link>
            ))}

            {ehAdministrador && (
              <Link href="/admin" onClick={fechar} className="nav-item flex items-center gap-3 py-3">
                <ShieldCheck size={19} aria-hidden />
                <span>Operação</span>
              </Link>
            )}

            <form action={sair} className="mt-1">
              <button
                type="submit"
                className="nav-item flex items-center gap-3 py-3 w-full text-left"
                style={{ color: "var(--selo)" }}
              >
                <LogOut size={19} aria-hidden />
                <span>Sair</span>
              </button>
            </form>
          </div>
        </div>
      )}

      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 grid grid-cols-5 nao-imprimir"
        style={{
          background: "#fff",
          borderTop: "1px solid var(--borda)",
          // Respeita a barra de gestos do iPhone.
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {ITENS_PRINCIPAIS.map(({ href, curto, Icone }) => {
          const ativo = estaAtivo(caminho, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={ativo ? "page" : undefined}
              className="flex flex-col items-center justify-center gap-0.5 py-2"
              style={{ color: ativo ? "var(--tinta)" : "var(--tinta-suave)" }}
            >
              <Icone size={21} strokeWidth={ativo ? 2.4 : 1.8} aria-hidden />
              <span className="text-[0.65rem]" style={{ fontWeight: ativo ? 600 : 400 }}>
                {curto}
              </span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => setGavetaAberta((v) => !v)}
          aria-expanded={gavetaAberta}
          className="flex flex-col items-center justify-center gap-0.5 py-2"
          style={{
            color: gavetaAberta || algumSecundarioAtivo ? "var(--tinta)" : "var(--tinta-suave)",
          }}
        >
          <Menu size={21} strokeWidth={gavetaAberta || algumSecundarioAtivo ? 2.4 : 1.8} aria-hidden />
          <span
            className="text-[0.65rem]"
            style={{ fontWeight: gavetaAberta || algumSecundarioAtivo ? 600 : 400 }}
          >
            Mais
          </span>
        </button>
      </nav>
    </>
  );
}
