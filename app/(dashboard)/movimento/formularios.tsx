"use client";

import { useActionState, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Briefcase, Package } from "lucide-react";
import { criarDocumento } from "@/app/actions/vendas";
import { criarLancamento } from "@/app/actions/lancamentos";
import { ESTADO_INICIAL } from "@/app/actions/tipos";
import { Aviso } from "@/components/ui/campos";
import { BotaoSubmit } from "@/components/ui/botao-submit";
import { CampoValor } from "@/components/ui/campo-valor";
import { ItensDocumento } from "@/components/ui/itens-documento";
import { hoje } from "@/lib/formato";
import { situacaoFiscal } from "@/lib/fiscal";

export type ClienteOpcao = { id: string; nome: string; documento: string | null };
export type Categoria = { id: string; nome: string; tipo: string };
export type TrabalhoOpcao = { id: string; numero: number; descricao_servico: string };

/**
 * Entrada e saída no mesmo lugar, alternadas por aba.
 *
 * Antes eram duas telas (Vendas e Financeiro) e a pessoa precisava saber de
 * antemão em qual delas o registro morava. Aqui a pergunta é só "entrou ou
 * saiu dinheiro?", que qualquer um responde.
 */
export function Formularios({
  clientes,
  categoriasDespesa,
  trabalhos,
}: {
  clientes: ClienteOpcao[];
  categoriasDespesa: Categoria[];
  trabalhos: TrabalhoOpcao[];
}) {
  const [aba, setAba] = useState<"entrada" | "saida">("entrada");

  return (
    <section className="fita-recibo px-5 md:px-6 py-6 mb-6">
      <div className="flex gap-2 mb-5">
        {(
          [
            { id: "entrada", rotulo: "Entrou dinheiro", Icone: ArrowUpRight },
            { id: "saida", rotulo: "Saiu dinheiro", Icone: ArrowDownLeft },
          ] as const
        ).map(({ id, rotulo, Icone }) => (
          <button
            key={id}
            type="button"
            onClick={() => setAba(id)}
            aria-pressed={aba === id}
            className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-2.5 rounded-md border"
            style={{
              borderColor: aba === id ? "var(--tinta)" : "var(--borda)",
              background: aba === id ? "var(--tinta)" : "transparent",
              color: aba === id ? "#fff" : "var(--tinta-suave)",
            }}
          >
            <Icone size={16} aria-hidden />
            {rotulo}
          </button>
        ))}
      </div>

      {aba === "entrada" ? (
        <FormularioEntrada clientes={clientes} />
      ) : (
        <FormularioSaida categorias={categoriasDespesa} trabalhos={trabalhos} />
      )}
    </section>
  );
}

function FormularioEntrada({ clientes }: { clientes: ClienteOpcao[] }) {
  const [estado, acao] = useActionState(criarDocumento, ESTADO_INICIAL);
  const [natureza, setNatureza] = useState<"servico" | "produto">("servico");
  const [tipo, setTipo] = useState<"recibo" | "orcamento">("recibo");
  const [recebido, setRecebido] = useState(true);
  const [clienteId, setClienteId] = useState("");
  const [detalhado, setDetalhado] = useState(false);

  const cliente = clientes.find((c) => c.id === clienteId);
  const fiscal = situacaoFiscal(natureza, cliente?.documento);

  return (
    <form key={estado.sucesso ?? "novo"} action={acao} className="flex flex-col gap-4">
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
          autoComplete="off"
          placeholder={
            natureza === "servico" ? "Ex: corte e escova" : "Ex: 2 shampoos 500ml"
          }
          className="campo"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {detalhado ? (
          <input type="hidden" name="valor" value="0" />
        ) : (
          <CampoValor />
        )}
        <div>
          <label className="rotulo" htmlFor="cliente_id">
            Cliente
            <span className="dica"> (opcional)</span>
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

      <ItensDocumento ativo={detalhado} aoAlternar={setDetalhado} />

      <div>
        <label className="rotulo" htmlFor="observacoes">
          Observações
          <span className="dica"> (opcional)</span>
        </label>
        <textarea
          id="observacoes"
          name="observacoes"
          rows={2}
          placeholder="Garantia, prazo, o que não está incluso..."
          className="campo"
        />
      </div>

      {/* O aviso fiscal aparece antes de emitir, não depois — é quando ainda
          dá para pedir o CNPJ do cliente. */}
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

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="recebido"
            value="sim"
            checked={recebido}
            onChange={(e) => setRecebido(e.target.checked)}
            disabled={tipo === "orcamento"}
          />
          Já recebi o valor
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={tipo === "orcamento"}
            onChange={(e) => setTipo(e.target.checked ? "orcamento" : "recibo")}
          />
          É só um orçamento
        </label>
        <input type="hidden" name="tipo" value={tipo} />
      </div>

      {!recebido && tipo === "recibo" && (
        <div className="sm:max-w-xs">
          <label className="rotulo" htmlFor="data_vencimento">
            Vence em
            <span className="dica"> (opcional)</span>
          </label>
          <input id="data_vencimento" name="data_vencimento" type="date" className="campo" />
          <p className="dica">Vai para a lista de cobranças.</p>
        </div>
      )}

      <input type="hidden" name="data_emissao" value={hoje()} />

      <Aviso estado={estado} />

      <div className="flex justify-end">
        <BotaoSubmit carregando="Emitindo...">
          {tipo === "orcamento" ? "Emitir orçamento" : "Emitir recibo"}
        </BotaoSubmit>
      </div>
    </form>
  );
}

function FormularioSaida({
  categorias,
  trabalhos,
}: {
  categorias: Categoria[];
  trabalhos: TrabalhoOpcao[];
}) {
  const [estado, acao] = useActionState(criarLancamento, ESTADO_INICIAL);

  return (
    <form key={estado.sucesso ?? "nova"} action={acao} className="flex flex-col gap-4">
      <div>
        <label className="rotulo" htmlFor="descricao">
          O que você pagou?
        </label>
        <input
          id="descricao"
          name="descricao"
          required
          autoComplete="off"
          placeholder="Ex: tinta e pincel"
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
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="rotulo" htmlFor="fornecedor_cliente">
            Fornecedor
            <span className="dica"> (opcional)</span>
          </label>
          <input id="fornecedor_cliente" name="fornecedor_cliente" autoComplete="off" className="campo" />
        </div>

        {/* A pergunta que separa faturamento de lucro. Fica opcional de
            propósito: gasto de estrutura (aluguel, internet) não é de
            trabalho nenhum, e obrigar a escolher faria a pessoa chutar. */}
        {trabalhos.length > 0 && (
          <div>
            <label className="rotulo" htmlFor="custo_de_documento_id">
              Foi custo de qual trabalho?
              <span className="dica"> (opcional)</span>
            </label>
            <select id="custo_de_documento_id" name="custo_de_documento_id" className="campo">
              <option value="">Gasto geral do negócio</option>
              {trabalhos.map((t) => (
                <option key={t.id} value={t.id}>
                  #{t.numero} · {t.descricao_servico}
                </option>
              ))}
            </select>
            <p className="dica">Vinculando, o recibo mostra quanto sobrou.</p>
          </div>
        )}
      </div>

      <Aviso estado={estado} />

      <div className="flex justify-end">
        <BotaoSubmit carregando="Lançando...">Lançar saída</BotaoSubmit>
      </div>
    </form>
  );
}
