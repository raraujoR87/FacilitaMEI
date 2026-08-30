"use client";

import { useActionState, useState } from "react";
import { Pencil } from "lucide-react";
import { editarLancamento } from "@/app/actions/lancamentos";
import { ESTADO_INICIAL } from "@/app/actions/tipos";
import { Aviso } from "@/components/ui/campos";
import { BotaoSubmit } from "@/components/ui/botao-submit";
import { CampoValor } from "@/components/ui/campo-valor";

export type SaidaEditavel = {
  id: string;
  descricao: string;
  valor: number;
  data_competencia: string;
  fornecedor_cliente: string | null;
  categoria_id: string | null;
};

/**
 * Correção de saída, recolhida na própria linha.
 *
 * Sem isto, um erro de digitação obrigava a excluir e relançar — e a
 * exclusão apaga o rastro, enquanto a edição fica registrada no histórico.
 */
export function EditarSaida({
  saida,
  categorias,
}: {
  saida: SaidaEditavel;
  categorias: { id: string; nome: string }[];
}) {
  const [estado, acao] = useActionState(editarLancamento, ESTADO_INICIAL);
  const [aberto, setAberto] = useState(false);

  if (estado.sucesso) {
    return (
      <p className="text-xs" style={{ color: "var(--positivo)" }}>
        {estado.sucesso}
      </p>
    );
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label={`Corrigir ${saida.descricao}`}
        className="botao botao-discreto px-1"
      >
        <Pencil size={14} aria-hidden />
      </button>
    );
  }

  return (
    <form action={acao} className="w-full mt-2 flex flex-col gap-2">
      <input type="hidden" name="id" value={saida.id} />

      <input
        name="descricao"
        defaultValue={saida.descricao}
        required
        autoComplete="off"
        className="campo"
      />

      <div className="grid gap-2 sm:grid-cols-3">
        <CampoValor centavosIniciais={Math.round(Number(saida.valor) * 100)} />
        <div>
          <label className="rotulo text-xs">Data</label>
          <input
            name="data_competencia"
            type="date"
            defaultValue={saida.data_competencia.slice(0, 10)}
            className="campo"
          />
        </div>
        <div>
          <label className="rotulo text-xs">Categoria</label>
          <select name="categoria_id" defaultValue={saida.categoria_id ?? ""} className="campo">
            <option value="">Sem categoria</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <input
        name="fornecedor_cliente"
        defaultValue={saida.fornecedor_cliente ?? ""}
        placeholder="Fornecedor"
        autoComplete="off"
        className="campo"
      />

      <Aviso estado={estado} />

      <div className="flex gap-2 justify-end">
        <button type="button" onClick={() => setAberto(false)} className="botao botao-secundario">
          Cancelar
        </button>
        <BotaoSubmit>Salvar</BotaoSubmit>
      </div>
    </form>
  );
}
