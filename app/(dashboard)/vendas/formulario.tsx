"use client";

import { useActionState, useState } from "react";
import { criarDocumento } from "@/app/actions/vendas";
import { ESTADO_INICIAL } from "@/app/actions/tipos";
import { Aviso } from "@/components/ui/campos";
import { BotaoSubmit } from "@/components/ui/botao-submit";
import { CampoValor } from "@/components/ui/campo-valor";
import { hoje } from "@/lib/formato";

export function FormularioVenda({
  clientes,
}: {
  clientes: { id: string; nome: string }[];
}) {
  const [estado, acao] = useActionState(criarDocumento, ESTADO_INICIAL);
  const [tipo, setTipo] = useState<"recibo" | "orcamento">("recibo");

  return (
    <form
      key={estado.sucesso ?? "novo"}
      action={acao}
      className="fita-recibo px-6 py-6 mb-8 flex flex-col gap-4"
    >
      <div className="flex gap-2">
        {(["recibo", "orcamento"] as const).map((opcao) => (
          <label
            key={opcao}
            className="flex-1 text-center text-sm font-medium py-2 rounded-md border cursor-pointer"
            style={{
              borderColor: tipo === opcao ? "var(--tinta)" : "var(--borda)",
              background: tipo === opcao ? "var(--tinta)" : "transparent",
              color: tipo === opcao ? "#fff" : "var(--tinta-suave)",
            }}
          >
            <input
              type="radio"
              name="tipo"
              value={opcao}
              checked={tipo === opcao}
              onChange={() => setTipo(opcao)}
              className="sr-only"
            />
            {opcao === "recibo" ? "Recibo" : "Orçamento"}
          </label>
        ))}
      </div>

      <div>
        <label className="rotulo" htmlFor="descricao_servico">
          Serviço ou produto
        </label>
        <input
          id="descricao_servico"
          name="descricao_servico"
          required
          autoComplete="off"
          placeholder="Ex: instalação de 3 pontos de luz"
          className="campo"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <CampoValor />
        <div>
          <label className="rotulo" htmlFor="cliente_id">
            Cliente
            <span className="dica"> (opcional)</span>
          </label>
          <select id="cliente_id" name="cliente_id" className="campo">
            <option value="">Sem cliente</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="rotulo" htmlFor="data_vencimento">
            Vence em
            <span className="dica"> (opcional)</span>
          </label>
          <input
            id="data_vencimento"
            name="data_vencimento"
            type="date"
            className="campo"
          />
          <p className="dica">Sem data, a cobrança fica sem prazo.</p>
        </div>
      </div>

      <input type="hidden" name="data_emissao" value={hoje()} />

      <Aviso estado={estado} />

      <div className="flex justify-end">
        <BotaoSubmit carregando="Emitindo...">
          Emitir {tipo === "recibo" ? "recibo" : "orçamento"}
        </BotaoSubmit>
      </div>
    </form>
  );
}
