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
import { NATUREZAS_SAIDA, SAIDA, type NaturezaSaida } from "@/lib/lancamentos";

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
  naturezaInicial,
  valorDasPadrao,
}: {
  clientes: ClienteOpcao[];
  categoriasDespesa: Categoria[];
  trabalhos: TrabalhoOpcao[];
  /**
   * Vem de `/movimento?lancar=`. A tela inicial não escreve mais: ela
   * manda para cá com a saída certa já escolhida, o que preserva o "um
   * toque" da baixa do DAS sem duplicar o formulário.
   */
  naturezaInicial: NaturezaSaida | null;
  valorDasPadrao: number | null;
}) {
  const [aba, setAba] = useState<"entrada" | "saida">(
    naturezaInicial ? "saida" : "entrada"
  );

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
        <FormularioSaida
          categorias={categoriasDespesa}
          trabalhos={trabalhos}
          naturezaInicial={naturezaInicial ?? "custo"}
          valorDasPadrao={valorDasPadrao}
        />
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
  const [docNovo, setDocNovo] = useState("");
  const [detalhado, setDetalhado] = useState(false);

  const cliente = clientes.find((c) => c.id === clienteId);
  const cadastrandoCliente = clienteId === "novo";

  // O aviso fiscal tem que enxergar o CPF/CNPJ que está sendo digitado
  // agora — senão a pessoa cadastra o cliente com documento e o aviso
  // continua dizendo que a nota é dispensada.
  const fiscal = situacaoFiscal(
    natureza,
    cadastrandoCliente ? docNovo : cliente?.documento
  );

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
            name={cadastrandoCliente ? undefined : "cliente_id"}
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
            <option value="novo">+ Cadastrar cliente novo</option>
          </select>
        </div>
      </div>

      {/* Cadastrar sem sair da venda. No balcão, com o cliente
          esperando, ninguém vai em outra tela cadastrar e volta — emite sem
          cliente e o vínculo se perde para sempre. */}
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
              placeholder="Ex: Maria Aparecida"
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
          <p className="dica">
            O cadastro fica salvo em Clientes; dá para completar depois.
          </p>
        </div>
      )}

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
  naturezaInicial,
  valorDasPadrao,
}: {
  categorias: Categoria[];
  trabalhos: TrabalhoOpcao[];
  naturezaInicial: NaturezaSaida;
  valorDasPadrao: number | null;
}) {
  const [estado, acao] = useActionState(criarLancamento, ESTADO_INICIAL);
  const [natureza, setNatureza] = useState<NaturezaSaida>(naturezaInicial);

  const ehCusto = natureza === "custo";
  const ehImposto = natureza === "imposto";

  return (
    <form
      key={`${estado.sucesso ?? "nova"}-${natureza}`}
      action={acao}
      className="flex flex-col gap-4"
    >
      {/* As três naturezas de saída no mesmo lugar. Antes, retirada e DAS
          moravam na tela inicial: quem aprendeu "saiu dinheiro, vou em
          Movimento" não achava a retirada. */}
      <div>
        <p className="rotulo">Que tipo de saída?</p>
        <div className="flex flex-wrap gap-2">
          {NATUREZAS_SAIDA.map((id) => (
            <label
              key={id}
              className="flex-1 min-w-[8rem] text-center text-sm py-2 rounded-md border cursor-pointer"
              style={{
                borderColor: natureza === id ? "var(--selo)" : "var(--borda)",
                background: natureza === id ? "rgba(194,59,34,0.07)" : "transparent",
                fontWeight: natureza === id ? 600 : 400,
              }}
            >
              <input
                type="radio"
                name="natureza_saida"
                value={id}
                checked={natureza === id}
                onChange={() => setNatureza(id)}
                className="sr-only"
              />
              {SAIDA[id].rotulo}
            </label>
          ))}
        </div>
        <p className="dica">{SAIDA[natureza].ajuda}</p>
      </div>

      {/* DAS não pede descrição: ela é sempre "DAS de MM/AAAA", e digitar
          isso todo mês é atrito num registro que deveria ser de um toque. */}
      {!ehImposto && (
        <div>
          <label className="rotulo" htmlFor="descricao">
            {ehCusto ? "O que você pagou?" : "Para quê?"}
            {!ehCusto && <span className="dica"> (opcional)</span>}
          </label>
          <input
            id="descricao"
            name="descricao"
            required={ehCusto}
            autoComplete="off"
            placeholder={ehCusto ? "Ex: tinta e pincel" : "Ex: pró-labore de agosto"}
            className="campo"
          />
        </div>
      )}

      <div className={`grid gap-4 ${ehCusto ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        <CampoValor
          centavosIniciais={
            ehImposto && valorDasPadrao ? Math.round(valorDasPadrao * 100) : 0
          }
        />
        <div>
          <label className="rotulo" htmlFor="data_competencia">
            {ehImposto ? "Competência" : "Data"}
          </label>
          <input
            id="data_competencia"
            name="data_competencia"
            type="date"
            defaultValue={hoje()}
            className="campo"
          />
          {ehImposto && (
            <p className="dica">
              O mês a que o DAS se refere. Pagando um atrasado, use o mês
              antigo — é assim que o contador espera ver.
            </p>
          )}
        </div>

        {/* Categoria só faz sentido no custo: retirada e DAS têm a sua
            fixa, e deixar escolher permitiria um DAS em "Alimentação". */}
        {ehCusto && (
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
        )}
      </div>

      {ehCusto && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="rotulo" htmlFor="fornecedor_cliente">
              Fornecedor
              <span className="dica"> (opcional)</span>
            </label>
            <input
              id="fornecedor_cliente"
              name="fornecedor_cliente"
              autoComplete="off"
              className="campo"
            />
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
              <select
                id="custo_de_documento_id"
                name="custo_de_documento_id"
                className="campo"
              >
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
      )}

      <Aviso estado={estado} />

      <div className="flex justify-end">
        <BotaoSubmit carregando="Lançando...">
          {ehImposto ? "Dar baixa no DAS" : "Lançar saída"}
        </BotaoSubmit>
      </div>
    </form>
  );
}
