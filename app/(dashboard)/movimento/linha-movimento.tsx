"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { excluirLancamento } from "@/app/actions/lancamentos";
import { BotaoQueRemove, LinhaAcao } from "@/components/ui/linha-acao";
import { FormularioEdicaoSaida, type SaidaEditavel } from "./editar-saida";

export type Vinculo = { href: string; texto: string };

/**
 * Uma linha do extrato, com a correção embutida.
 *
 * Mesmo motivo da linha de clientes: o formulário é `w-full` e a célula de
 * ações é `shrink-0`, para o valor não amassar. Um dentro do outro, a linha
 * ficava mais larga que a tela — medido em 379px numa viewport de 375, o
 * bastante para a página inteira ganhar rolagem horizontal no celular.
 * Sendo dona do estado, a linha troca o resumo pelo formulário.
 */
export function LinhaMovimento({
  titulo,
  href,
  detalhe,
  fiscal,
  custoDe,
  valor,
  valorCor,
  saida,
  categorias,
  trabalhos,
}: {
  titulo: string;
  /** Recibo ao qual a linha pertence; saída avulsa não tem. */
  href: string | null;
  detalhe: string;
  fiscal: { texto: string; cor: string } | null;
  custoDe: Vinculo | null;
  valor: string;
  valorCor: string;
  /** Só despesa avulsa é editável: entrada pertence a um recibo. */
  saida: SaidaEditavel | null;
  categorias: { id: string; nome: string }[];
  trabalhos: { id: string; numero: number; descricao_servico: string }[];
}) {
  const [editando, setEditando] = useState(false);

  if (editando && saida) {
    return (
      <div className="py-4">
        <FormularioEdicaoSaida
          saida={saida}
          categorias={categorias}
          trabalhos={trabalhos}
          aoFechar={() => setEditando(false)}
        />
      </div>
    );
  }

  return (
    <LinhaAcao className="py-3 text-sm flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-start sm:gap-3">
      <div className="min-w-0 sm:flex-1">
        {href ? (
          <Link href={href} className="font-medium truncate block underline">
            {titulo}
          </Link>
        ) : (
          <p className="font-medium truncate">{titulo}</p>
        )}

        <p className="text-xs" style={{ color: "var(--tinta-suave)" }}>
          {detalhe}
        </p>

        {custoDe && (
          <Link
            href={custoDe.href}
            className="text-xs underline"
            style={{ color: "var(--tinta-suave)" }}
          >
            {custoDe.texto}
          </Link>
        )}

        {fiscal && (
          <p className="text-xs mt-1" style={{ color: fiscal.cor }}>
            {fiscal.texto}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 shrink-0 sm:justify-end">
        <span className="valor whitespace-nowrap" style={{ color: valorCor }}>
          {valor}
        </span>

        {/* Entrada não se apaga nem se edita solta: ela pertence a um recibo
            numerado, e mexer aqui deixaria documento e lançamento
            divergentes. A correção dela é feita no próprio recibo. */}
        {saida && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setEditando(true)}
              aria-label={`Corrigir ${saida.descricao}`}
              className="botao botao-discreto px-1"
            >
              <Pencil size={14} aria-hidden />
            </button>
            <BotaoQueRemove acao={excluirLancamento} id={saida.id} variante="discreto">
              Excluir
            </BotaoQueRemove>
          </div>
        )}
      </div>
    </LinhaAcao>
  );
}
