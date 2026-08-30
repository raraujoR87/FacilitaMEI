"use client";

import { useActionState, useState } from "react";
import { criarLancamento } from "@/app/actions/lancamentos";
import { ESTADO_INICIAL } from "@/app/actions/tipos";
import { Aviso } from "@/components/ui/campos";
import { BotaoSubmit } from "@/components/ui/botao-submit";
import { CampoValor } from "@/components/ui/campo-valor";
import { hoje } from "@/lib/formato";

export type Categoria = { id: string; nome: string; tipo: string };

export function FormularioLancamento({ categorias }: { categorias: Categoria[] }) {
  const [estado, acao] = useActionState(criarLancamento, ESTADO_INICIAL);
  const [tipo, setTipo] = useState<"receita" | "despesa">("despesa");

  // Remontar o formulário depois de salvar é o jeito mais direto de zerar
  // os campos controlados (o valor mascarado guarda estado próprio).
  const chave = estado.sucesso ?? "novo";

  const categoriasDoTipo = categorias.filter((c) => c.tipo === tipo);

  return (
    <form key={chave} action={acao} className="fita-recibo px-6 py-6 mb-8 flex flex-col gap-4">
      <div className="flex gap-2">
        {(["despesa", "receita"] as const).map((opcao) => (
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
            {opcao === "despesa" ? "Saída" : "Entrada"}
          </label>
        ))}
      </div>

      <div>
        <label className="rotulo" htmlFor="descricao">
          O que foi?
        </label>
        <input
          id="descricao"
          name="descricao"
          required
          autoComplete="off"
          placeholder={tipo === "despesa" ? "Ex: tinta e pincel" : "Ex: pintura do apartamento 32"}
          className="campo"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <CampoValor />
        <div>
          <label className="rotulo" htmlFor="data_competencia">
            Data
          </label>
          <input
            id="data_competencia"
            name="data_competencia"
            type="date"
            defaultValue={hoje()}
            className="campo"
          />
        </div>
        <div>
          <label className="rotulo" htmlFor="categoria_id">
            Categoria
          </label>
          <select id="categoria_id" name="categoria_id" className="campo">
            <option value="">Sem categoria</option>
            {categoriasDoTipo.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="rotulo" htmlFor="fornecedor_cliente">
          {tipo === "despesa" ? "Fornecedor" : "Cliente"}
          <span className="dica"> (opcional)</span>
        </label>
        <input
          id="fornecedor_cliente"
          name="fornecedor_cliente"
          autoComplete="off"
          className="campo"
        />
      </div>

      <Aviso estado={estado} />

      <div className="flex justify-end">
        <BotaoSubmit carregando="Lançando...">Lançar</BotaoSubmit>
      </div>
    </form>
  );
}
