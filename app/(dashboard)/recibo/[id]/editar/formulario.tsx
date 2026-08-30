"use client";

import { useActionState, useState } from "react";
import { Briefcase, Package } from "lucide-react";
import { editarDocumento } from "@/app/actions/vendas";
import { ESTADO_INICIAL } from "@/app/actions/tipos";
import { Aviso } from "@/components/ui/campos";
import { BotaoSubmit } from "@/components/ui/botao-submit";
import { CampoValor } from "@/components/ui/campo-valor";
import { ItensDocumento, type LinhaItem } from "@/components/ui/itens-documento";
import { situacaoFiscal, type Natureza } from "@/lib/fiscal";

export type DocumentoEdicao = {
  id: string;
  numero: number;
  natureza: Natureza;
  descricao_servico: string;
  valor: number;
  cliente_id: string | null;
  data_vencimento: string | null;
  observacoes: string | null;
  status: string;
};

export function FormularioEdicao({
  documento,
  itens,
  clientes,
}: {
  documento: DocumentoEdicao;
  itens: LinhaItem[];
  clientes: { id: string; nome: string; documento: string | null }[];
}) {
  const [estado, acao] = useActionState(editarDocumento, ESTADO_INICIAL);
  const [natureza, setNatureza] = useState<Natureza>(documento.natureza);
  const [clienteId, setClienteId] = useState(documento.cliente_id ?? "");
  const [detalhado, setDetalhado] = useState(itens.length > 0);

  const cliente = clientes.find((c) => c.id === clienteId);
  const fiscal = situacaoFiscal(natureza, cliente?.documento);

  return (
    <form action={acao} className="fita-recibo px-5 md:px-6 py-6 flex flex-col gap-4">
      <input type="hidden" name="id" value={documento.id} />

      <div>
        <p className="rotulo">O que foi?</p>
        <div className="flex gap-2">
          {(
            [
              { id: "servico", rotulo: "Serviço prestado", Icone: Briefcase },
              { id: "produto", rotulo: "Produto vendido", Icone: Package },
            ] as const
          ).map(({ id, rotulo, Icone }) => (
            <label
              key={id}
              className="flex-1 flex items-center justify-center gap-1.5 text-sm py-2 rounded-md border cursor-pointer"
              style={{
                borderColor: natureza === id ? "var(--positivo)" : "var(--borda)",
                background: natureza === id ? "rgba(47,110,91,0.08)" : "transparent",
                fontWeight: natureza === id ? 600 : 400,
              }}
            >
              <input
                type="radio"
                name="natureza"
                value={id}
                checked={natureza === id}
                onChange={() => setNatureza(id)}
                className="sr-only"
              />
              <Icone size={15} aria-hidden />
              {rotulo}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="rotulo" htmlFor="descricao_servico">
          Descrição
        </label>
        <input
          id="descricao_servico"
          name="descricao_servico"
          required
          defaultValue={documento.descricao_servico}
          autoComplete="off"
          className="campo"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {detalhado ? (
          <input type="hidden" name="valor" value="0" />
        ) : (
          <CampoValor centavosIniciais={Math.round(Number(documento.valor) * 100)} />
        )}
        <div>
          <label className="rotulo" htmlFor="cliente_id">
            Cliente
          </label>
          <select
            id="cliente_id"
            name="cliente_id"
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
            className="campo"
          >
            <option value="">Sem cliente</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
                {c.documento ? "" : " (sem CPF/CNPJ)"}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ItensDocumento ativo={detalhado} aoAlternar={setDetalhado} iniciais={itens} />

      {documento.status === "pendente" && (
        <div className="sm:max-w-xs">
          <label className="rotulo" htmlFor="data_vencimento">
            Vence em
          </label>
          <input
            id="data_vencimento"
            name="data_vencimento"
            type="date"
            defaultValue={documento.data_vencimento?.slice(0, 10)}
            className="campo"
          />
        </div>
      )}

      <div>
        <label className="rotulo" htmlFor="observacoes">
          Observações
        </label>
        <textarea
          id="observacoes"
          name="observacoes"
          rows={2}
          defaultValue={documento.observacoes ?? ""}
          className="campo"
        />
      </div>

      <p
        className="aviso"
        style={{
          borderColor: fiscal.obrigatoria ? "var(--pendente)" : "var(--borda)",
          color: fiscal.obrigatoria ? "var(--tinta)" : "var(--tinta-suave)",
          background: fiscal.obrigatoria ? "rgba(217,164,65,0.10)" : "transparent",
        }}
      >
        <strong>{fiscal.resumo}.</strong> {fiscal.detalhe}
      </p>

      {documento.status === "pago" && (
        <p className="dica">
          Este recibo já foi recebido: alterar o valor ajusta também a receita
          lançada no financeiro.
        </p>
      )}

      <Aviso estado={estado} />

      <div className="flex justify-end">
        <BotaoSubmit>Salvar alterações</BotaoSubmit>
      </div>
    </form>
  );
}
