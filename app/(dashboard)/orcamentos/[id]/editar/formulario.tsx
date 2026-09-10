"use client";

import { useActionState, useState } from "react";
import { editarOrcamento } from "@/app/actions/orcamentos";
import { ESTADO_INICIAL } from "@/app/actions/tipos";
import { Aviso } from "@/components/ui/campos";
import { BotaoSubmit } from "@/components/ui/botao-submit";
import { CampoValor } from "@/components/ui/campo-valor";
import { ItensDocumento, type LinhaItem } from "@/components/ui/itens-documento";

type OrcamentoEditavel = {
  id: string;
  natureza: "servico" | "produto";
  descricao_servico: string;
  valor: number;
  desconto: number;
  validade_em: string | null;
  condicoes_pagamento: string | null;
  prazo_execucao: string | null;
  garantia: string | null;
  observacoes: string | null;
  cliente_id: string | null;
};

type ItemExistente = {
  descricao: string;
  quantidade: number;
  unidade: string;
  valorUnitario: number;
};

export function FormularioEdicaoOrcamento({
  orcamento,
  itens,
  clientes,
}: {
  orcamento: OrcamentoEditavel;
  itens: ItemExistente[];
  clientes: { id: string; nome: string }[];
}) {
  const [estado, acao] = useActionState(editarOrcamento, ESTADO_INICIAL);
  const [detalhado, setDetalhado] = useState(itens.length > 0);

  const iniciais: LinhaItem[] = itens.map((item, i) => ({
    chave: i + 1,
    descricao: item.descricao,
    quantidade: String(item.quantidade).replace(".", ","),
    unidade: item.unidade,
    centavos: Math.round(item.valorUnitario * 100),
  }));

  return (
    <form action={acao} className="fita-recibo px-5 md:px-6 py-6 flex flex-col gap-4">
      <input type="hidden" name="id" value={orcamento.id} />
      <input type="hidden" name="natureza" value={orcamento.natureza} />

      <div>
        <label className="rotulo" htmlFor="descricao_servico">
          Título da proposta
        </label>
        <input
          id="descricao_servico"
          name="descricao_servico"
          required
          defaultValue={orcamento.descricao_servico}
          autoComplete="off"
          className="campo"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="rotulo" htmlFor="cliente_id">
            Cliente
          </label>
          <select
            id="cliente_id"
            name="cliente_id"
            defaultValue={orcamento.cliente_id ?? ""}
            className="campo"
          >
            <option value="">Sem cliente</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="rotulo" htmlFor="validade_em">
            Validade
          </label>
          <input
            id="validade_em"
            name="validade_em"
            type="date"
            defaultValue={orcamento.validade_em?.slice(0, 10) ?? ""}
            className="campo"
          />
        </div>
      </div>

      <ItensDocumento
        ativo={detalhado}
        aoAlternar={setDetalhado}
        iniciais={iniciais}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {!detalhado && (
          <CampoValor
            label="Valor total"
            centavosIniciais={Math.round(orcamento.valor * 100)}
          />
        )}
        <CampoValor
          nome="desconto"
          label="Desconto"
          centavosIniciais={Math.round(orcamento.desconto * 100)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="rotulo" htmlFor="condicoes_pagamento">
            Condições de pagamento
          </label>
          <input
            id="condicoes_pagamento"
            name="condicoes_pagamento"
            defaultValue={orcamento.condicoes_pagamento ?? ""}
            autoComplete="off"
            className="campo"
          />
        </div>
        <div>
          <label className="rotulo" htmlFor="prazo_execucao">
            Prazo de execução
          </label>
          <input
            id="prazo_execucao"
            name="prazo_execucao"
            defaultValue={orcamento.prazo_execucao ?? ""}
            autoComplete="off"
            className="campo"
          />
        </div>
      </div>

      <div>
        <label className="rotulo" htmlFor="garantia">
          Garantia
        </label>
        <input
          id="garantia"
          name="garantia"
          defaultValue={orcamento.garantia ?? ""}
          autoComplete="off"
          className="campo"
        />
      </div>

      <div>
        <label className="rotulo" htmlFor="observacoes">
          Observações
        </label>
        <textarea
          id="observacoes"
          name="observacoes"
          rows={2}
          defaultValue={orcamento.observacoes ?? ""}
          className="campo"
        />
      </div>

      <Aviso estado={estado} />

      <div className="flex justify-end">
        <BotaoSubmit>Salvar proposta</BotaoSubmit>
      </div>
    </form>
  );
}
