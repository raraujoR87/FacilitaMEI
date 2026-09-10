"use client";

import { useActionState, useState } from "react";
import { Briefcase, Package } from "lucide-react";
import { criarOrcamento } from "@/app/actions/orcamentos";
import { ESTADO_INICIAL } from "@/app/actions/tipos";
import { Aviso } from "@/components/ui/campos";
import { BotaoSubmit } from "@/components/ui/botao-submit";
import { CampoValor } from "@/components/ui/campo-valor";
import { CampoDesconto } from "@/components/ui/campo-desconto";
import { ItensDocumento } from "@/components/ui/itens-documento";
import { hoje } from "@/lib/formato";
import { situacaoFiscal } from "@/lib/fiscal";
import { validadeSugerida, VALIDADE_PADRAO_DIAS } from "@/lib/orcamento";

export type ClienteOpcao = { id: string; nome: string; documento: string | null };

/**
 * Nova proposta.
 *
 * Separado do formulário de Movimento de propósito: lá se registra o que
 * já aconteceu, aqui se propõe o que pode acontecer. Enquanto os dois
 * moravam no mesmo lugar, o orçamento herdava campos que não são dele
 * ("já recebi o valor") e não tinha os que são (validade, condições).
 */
export function FormularioOrcamento({ clientes }: { clientes: ClienteOpcao[] }) {
  const [estado, acao] = useActionState(criarOrcamento, ESTADO_INICIAL);
  const [aberto, setAberto] = useState(false);
  const [natureza, setNatureza] = useState<"servico" | "produto">("servico");
  const [clienteId, setClienteId] = useState("");
  const [docNovo, setDocNovo] = useState("");
  const [detalhado, setDetalhado] = useState(true);

  const cliente = clientes.find((c) => c.id === clienteId);
  const cadastrandoCliente = clienteId === "novo";
  const fiscal = situacaoFiscal(
    natureza,
    cadastrandoCliente ? docNovo : cliente?.documento
  );

  if (!aberto) {
    return (
      <div className="mb-6">
        <button type="button" onClick={() => setAberto(true)} className="botao">
          Nova proposta
        </button>
      </div>
    );
  }

  return (
    <form
      key={estado.sucesso ?? "nova"}
      action={acao}
      className="fita-recibo px-5 md:px-6 py-6 mb-6 flex flex-col gap-4"
    >
      <div>
        <p className="rotulo">O que você vai propor?</p>
        <div className="flex gap-2">
          {(
            [
              { id: "servico", rotulo: "Serviço", Icone: Briefcase },
              { id: "produto", rotulo: "Produto", Icone: Package },
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
          Título da proposta
        </label>
        <input
          id="descricao_servico"
          name="descricao_servico"
          required
          autoComplete="off"
          placeholder="Ex: Pintura completa do apartamento 302"
          className="campo"
        />
        <p className="dica">É o que o cliente lê primeiro. Seja específico.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="rotulo" htmlFor="cliente_id">
            Cliente
          </label>
          <select
            id="cliente_id"
            name={cadastrandoCliente ? undefined : "cliente_id"}
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
            className="campo"
          >
            <option value="">Sem cliente</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
            <option value="novo">+ Cadastrar cliente novo</option>
          </select>
        </div>

        <div>
          <label className="rotulo" htmlFor="validade_em">
            Validade da proposta
          </label>
          <input
            id="validade_em"
            name="validade_em"
            type="date"
            defaultValue={validadeSugerida(hoje())}
            className="campo"
          />
          <p className="dica">
            Padrão de {VALIDADE_PADRAO_DIAS} dias. Sem prazo, o cliente volta
            meses depois cobrando um preço que o material já não tem.
          </p>
        </div>
      </div>

      {cadastrandoCliente && (
        <div
          className="rounded-md border p-4 flex flex-col gap-3"
          style={{ borderColor: "var(--borda)", background: "var(--papel)" }}
        >
          <p className="text-xs uppercase tracking-widest" style={{ color: "var(--tinta-suave)" }}>
            Cliente novo
          </p>
          <div>
            <label className="rotulo" htmlFor="cliente_novo_nome">
              Nome
            </label>
            <input
              id="cliente_novo_nome"
              name="cliente_novo_nome"
              required
              autoComplete="off"
              className="campo"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="rotulo" htmlFor="cliente_novo_documento">
                CPF ou CNPJ
                <span className="dica"> (opcional)</span>
              </label>
              <input
                id="cliente_novo_documento"
                name="cliente_novo_documento"
                inputMode="numeric"
                autoComplete="off"
                value={docNovo}
                onChange={(e) => setDocNovo(e.target.value)}
                className="campo"
              />
            </div>
            <div>
              <label className="rotulo" htmlFor="cliente_novo_telefone">
                Telefone
                <span className="dica"> (opcional)</span>
              </label>
              <input
                id="cliente_novo_telefone"
                name="cliente_novo_telefone"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                className="campo"
              />
            </div>
          </div>
        </div>
      )}

      {/* Detalhado por padrão, ao contrário do recibo: proposta sem itens é
          só um número, e o cliente negocia no escuro. */}
      <ItensDocumento ativo={detalhado} aoAlternar={setDetalhado} />

      <div className="grid gap-4 sm:grid-cols-2">
        {!detalhado && <CampoValor label="Valor total" />}
        <CampoDesconto />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="rotulo" htmlFor="condicoes_pagamento">
            Condições de pagamento
            <span className="dica"> (opcional)</span>
          </label>
          <input
            id="condicoes_pagamento"
            name="condicoes_pagamento"
            autoComplete="off"
            placeholder="Ex: 50% na aprovação, 50% na entrega"
            className="campo"
          />
        </div>
        <div>
          <label className="rotulo" htmlFor="prazo_execucao">
            Prazo de execução
            <span className="dica"> (opcional)</span>
          </label>
          <input
            id="prazo_execucao"
            name="prazo_execucao"
            autoComplete="off"
            placeholder="Ex: 5 dias úteis após aprovação"
            className="campo"
          />
        </div>
      </div>

      <div>
        <label className="rotulo" htmlFor="garantia">
          Garantia
          <span className="dica"> (opcional)</span>
        </label>
        <input
          id="garantia"
          name="garantia"
          autoComplete="off"
          placeholder="Ex: 90 dias para o serviço executado"
          className="campo"
        />
      </div>

      <div>
        <label className="rotulo" htmlFor="observacoes">
          Observações
          <span className="dica"> (opcional)</span>
        </label>
        <textarea
          id="observacoes"
          name="observacoes"
          rows={2}
          placeholder="O que não está incluso, quem fornece o material..."
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
        <strong>{fiscal.resumo}.</strong> {fiscal.detalhe} Isso vale quando a
        proposta virar serviço executado — orçamento em si não gera nota.
      </p>

      <input type="hidden" name="data_emissao" value={hoje()} />

      <Aviso estado={estado} />

      <div className="flex flex-wrap gap-2 justify-end">
        <button type="button" onClick={() => setAberto(false)} className="botao botao-secundario">
          Fechar
        </button>
        <BotaoSubmit carregando="Criando...">Criar proposta</BotaoSubmit>
      </div>
    </form>
  );
}
