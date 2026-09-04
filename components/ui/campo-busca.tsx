"use client";

import { useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

/**
 * Busca que filtra enquanto se digita.
 *
 * O termo vive na URL, não em estado local: assim o filtro sobrevive ao
 * recarregar, pode ser compartilhado, e o botão de voltar desfaz a busca
 * como a pessoa espera.
 *
 * O atraso de 300ms não é enfeite — sem ele cada tecla vira uma consulta
 * ao servidor, e num celular em rede ruim a lista pisca a cada letra.
 */
export function CampoBusca({
  placeholder,
  rotulo = "Buscar",
}: {
  placeholder: string;
  rotulo?: string;
}) {
  const router = useRouter();
  const caminho = usePathname();
  const parametros = useSearchParams();
  const [carregando, iniciar] = useTransition();
  const [valor, setValor] = useState(parametros.get("q") ?? "");
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  function navegar(termo: string) {
    const busca = new URLSearchParams(parametros.toString());
    if (termo.trim()) busca.set("q", termo.trim());
    else busca.delete("q");

    // `replace` em vez de `push`: cada letra digitada viraria uma entrada
    // no histórico, e voltar exigiria um toque por caractere.
    iniciar(() => router.replace(`${caminho}?${busca.toString()}`, { scroll: false }));
  }

  function aoDigitar(termo: string) {
    setValor(termo);
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => navegar(termo), 300);
  }

  function limpar() {
    if (temporizador.current) clearTimeout(temporizador.current);
    setValor("");
    navegar("");
  }

  return (
    <div className="relative">
      <label htmlFor="busca" className="sr-only">
        {rotulo}
      </label>
      <Search
        size={15}
        aria-hidden
        className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: "var(--tinta-suave)" }}
      />
      <input
        id="busca"
        type="search"
        value={valor}
        onChange={(e) => aoDigitar(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        aria-busy={carregando}
        className="campo pl-9 pr-9"
        style={{ opacity: carregando ? 0.7 : 1, transition: "opacity 120ms ease" }}
      />
      {valor && (
        <button
          type="button"
          onClick={limpar}
          aria-label="Limpar busca"
          className="absolute right-2 top-1/2 -translate-y-1/2 botao botao-discreto px-1"
        >
          <X size={14} aria-hidden />
        </button>
      )}
    </div>
  );
}
