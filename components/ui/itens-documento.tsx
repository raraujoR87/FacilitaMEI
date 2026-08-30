"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { formatarCentavos, formatarMoeda, lerNumeroBR } from "@/lib/formato";

export type LinhaItem = {
  chave: number;
  descricao: string;
  quantidade: string;
  unidade: string;
  centavos: number;
};

const UNIDADES = ["un", "h", "kg", "m", "m²", "dia", "serviço"];

export function linhaVazia(chave: number): LinhaItem {
  return { chave, descricao: "", quantidade: "1", unidade: "un", centavos: 0 };
}

/** "2,5" e "2.5" significam a mesma coisa para quem digita. */
export function lerQuantidade(texto: string): number {
  const n = lerNumeroBR(texto);
  return n > 0 ? n : 0;
}

export function totalDaLinha(linha: LinhaItem): number {
  // Arredonda por linha antes de somar, igual à coluna gerada no banco.
  return Math.round(lerQuantidade(linha.quantidade) * linha.centavos) / 100;
}

/**
 * Detalhamento por item.
 *
 * Fica recolhido por padrão: a maioria dos registros é de uma linha só, e
 * abrir uma tabela para todo mundo faria o caminho comum ficar mais lento.
 * Quem precisa de "3 cortes a R$ 45" ou de peça e mão de obra separadas
 * abre e detalha.
 */
export function ItensDocumento({
  ativo,
  aoAlternar,
  iniciais,
}: {
  ativo: boolean;
  aoAlternar: (ativo: boolean) => void;
  /** Linhas já existentes, ao editar um documento. */
  iniciais?: LinhaItem[];
}) {
  const [linhas, setLinhas] = useState<LinhaItem[]>(
    iniciais && iniciais.length > 0 ? iniciais : [linhaVazia(1)]
  );

  const total = linhas.reduce((soma, l) => soma + totalDaLinha(l), 0);

  function atualizar(chave: number, mudanca: Partial<LinhaItem>) {
    setLinhas((atual) =>
      atual.map((l) => (l.chave === chave ? { ...l, ...mudanca } : l))
    );
  }

  function adicionar() {
    setLinhas((atual) => [
      ...atual,
      linhaVazia(Math.max(0, ...atual.map((l) => l.chave)) + 1),
    ]);
  }

  function remover(chave: number) {
    // Nunca deixa a tabela sem nenhuma linha: um formulário vazio sem campo
    // para preencher é um beco sem saída.
    setLinhas((atual) =>
      atual.length === 1 ? [linhaVazia(1)] : atual.filter((l) => l.chave !== chave)
    );
  }

  return (
    <div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={ativo}
          onChange={(e) => aoAlternar(e.target.checked)}
        />
        Detalhar item por item
      </label>

      {!ativo ? (
        <p className="dica">
          Quantidade, unidade e valor por linha — útil para orçamento e
          obrigatório na nota de produto.
        </p>
      ) : (
        <div className="mt-3">
          <div className="flex flex-col gap-3">
            {linhas.map((linha, i) => (
              <div
                key={linha.chave}
                className="rounded-md border px-3 py-3"
                style={{ borderColor: "var(--borda)", background: "var(--papel)" }}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-xs" style={{ color: "var(--tinta-suave)" }}>
                    Item {i + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => remover(linha.chave)}
                    aria-label={`Remover item ${i + 1}`}
                    style={{ color: "var(--tinta-suave)" }}
                  >
                    <Trash2 size={15} aria-hidden />
                  </button>
                </div>

                <input
                  name="item_descricao"
                  value={linha.descricao}
                  onChange={(e) => atualizar(linha.chave, { descricao: e.target.value })}
                  placeholder="Descrição do item"
                  autoComplete="off"
                  className="campo mb-2"
                />

                <div className="grid grid-cols-[4.5rem_5.5rem_1fr] gap-2 items-end">
                  <div>
                    <label className="rotulo text-xs">Qtd</label>
                    <input
                      name="item_quantidade"
                      value={linha.quantidade}
                      onChange={(e) =>
                        atualizar(linha.chave, { quantidade: e.target.value })
                      }
                      inputMode="decimal"
                      className="campo campo-valor"
                    />
                  </div>

                  <div>
                    <label className="rotulo text-xs">Unidade</label>
                    <select
                      name="item_unidade"
                      value={linha.unidade}
                      onChange={(e) => atualizar(linha.chave, { unidade: e.target.value })}
                      className="campo"
                    >
                      {UNIDADES.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="rotulo text-xs">Valor unitário</label>
                    <div className="flex">
                      <span
                        className="inline-flex items-center px-2 text-xs rounded-l-md border border-r-0"
                        style={{
                          borderColor: "var(--borda)",
                          background: "var(--papel-escuro)",
                          color: "var(--tinta-suave)",
                        }}
                      >
                        R$
                      </span>
                      <input
                        inputMode="numeric"
                        value={formatarCentavos(linha.centavos)}
                        onChange={(e) => {
                          const digitos = e.target.value.replace(/\D/g, "").slice(0, 11);
                          atualizar(linha.chave, {
                            centavos: digitos === "" ? 0 : Number(digitos),
                          });
                        }}
                        onFocus={(e) => e.target.select()}
                        className="campo campo-valor rounded-l-none"
                      />
                    </div>
                    {/* O número puro vai escondido; o visível é o mascarado. */}
                    <input
                      type="hidden"
                      name="item_valor"
                      value={(linha.centavos / 100).toFixed(2)}
                    />
                  </div>
                </div>

                <p className="dica text-right mt-1">
                  Subtotal {formatarMoeda(totalDaLinha(linha))}
                </p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between mt-3">
            <button type="button" onClick={adicionar} className="botao botao-secundario">
              <Plus size={15} aria-hidden />
              Adicionar item
            </button>
            <p className="text-sm">
              Total{" "}
              <strong className="valor" style={{ color: "var(--positivo)" }}>
                {formatarMoeda(total)}
              </strong>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
