"use client";

import { useActionState, useState } from "react";
import { CircleCheck, Plus, Repeat } from "lucide-react";
import {
  criarDespesaFixa,
  desativarDespesaFixa,
  lancarDespesaFixa,
} from "@/app/actions/recorrentes";
import { ESTADO_INICIAL } from "@/app/actions/tipos";
import { Aviso } from "@/components/ui/campos";
import { BotaoSubmit } from "@/components/ui/botao-submit";
import { BotaoQueRemove, LinhaAcao } from "@/components/ui/linha-acao";
import { CampoValor } from "@/components/ui/campo-valor";
import { formatarData, formatarMoeda } from "@/lib/formato";
import {
  descreverVencimento,
  resumirFixas,
  venceuNoMes,
  type ContaFixa,
} from "@/lib/recorrentes";

/**
 * Contas fixas do mês.
 *
 * Aluguel e internet são o gasto mais previsível e o mais esquecido — e é
 * esse esquecimento que faz o caixa parecer melhor do que é justamente no
 * fim do mês, quando as contas chegam. A seção existe para lembrar, não
 * para lançar sozinha.
 */
export function ContasFixas({
  contas,
  categorias,
  mes,
  hojeISO,
  dataPadrao,
}: {
  contas: ContaFixa[];
  categorias: { id: string; nome: string }[];
  mes: string;
  hojeISO: string;
  /** Data usada no lançamento: hoje no mês corrente, dia 1 nos passados. */
  dataPadrao: string;
}) {
  const [abrindo, setAbrindo] = useState(false);
  const { pendentes, lancadas, aLancar, lancado } = resumirFixas(contas);

  return (
    <section className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h2 className="text-sm font-semibold flex items-center gap-1.5">
          <Repeat size={15} aria-hidden />
          Contas fixas
        </h2>
        <button
          type="button"
          onClick={() => setAbrindo((v) => !v)}
          className="botao botao-discreto px-0"
        >
          <Plus size={14} aria-hidden />
          Nova conta fixa
        </button>
      </div>

      <div
        className="rounded-lg border"
        style={{
          borderColor: aLancar > 0 ? "var(--pendente)" : "var(--borda)",
          background: "#fff",
        }}
      >
        {contas.length === 0 && !abrindo ? (
          <p className="px-5 py-4 text-sm" style={{ color: "var(--tinta-suave)" }}>
            Cadastre aluguel, internet, telefone — o que se repete todo mês.
            Elas passam a aparecer aqui para lançar num toque, sem você
            precisar lembrar.
          </p>
        ) : (
          <>
            {aLancar > 0 && (
              <p
                className="px-5 py-3 text-sm border-b"
                style={{ borderColor: "var(--borda)" }}
              >
                <strong>{formatarMoeda(aLancar)}</strong> em contas fixas ainda
                não lançados neste mês.{" "}
                <span style={{ color: "var(--tinta-suave)" }}>
                  Enquanto não entram, o caixa parece maior do que é.
                </span>
              </p>
            )}

            {pendentes.map((c) => (
              <LinhaPendente
                key={c.id}
                conta={c}
                atrasada={venceuNoMes(c, mes, hojeISO)}
                dataPadrao={dataPadrao}
              />
            ))}

            {lancadas.map((c) => (
              <div
                key={c.id}
                className="px-5 py-3 flex flex-wrap justify-between items-center gap-2 text-sm border-t"
                style={{ borderColor: "var(--borda)" }}
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <CircleCheck
                    size={15}
                    aria-hidden
                    style={{ color: "var(--positivo)" }}
                  />
                  <span className="truncate">{c.descricao}</span>
                  {c.lancado_em && (
                    <span
                      className="text-xs shrink-0"
                      style={{ color: "var(--tinta-suave)" }}
                    >
                      lançada em {formatarData(c.lancado_em)}
                    </span>
                  )}
                </span>
                <span
                  className="valor shrink-0"
                  style={{ color: "var(--tinta-suave)" }}
                >
                  {formatarMoeda(Number(c.valor_lancado ?? c.valor))}
                </span>
              </div>
            ))}

            {lancado > 0 && (
              <p
                className="px-5 py-2 text-xs border-t"
                style={{ borderColor: "var(--borda)", color: "var(--tinta-suave)" }}
              >
                {formatarMoeda(lancado)} de contas fixas já lançados no mês.
              </p>
            )}
          </>
        )}

        {abrindo && (
          <FormularioNova categorias={categorias} aoFechar={() => setAbrindo(false)} />
        )}
      </div>

      {contas.length > 0 && (
        <p className="dica">
          Conta fixa cadastrada não vira lançamento sozinha — o valor muda, a
          conta atrasa, e dinheiro que o app inventa é dinheiro em que não se
          confia.
        </p>
      )}
    </section>
  );
}

function LinhaPendente({
  conta,
  atrasada,
  dataPadrao,
}: {
  conta: ContaFixa;
  atrasada: boolean;
  dataPadrao: string;
}) {
  const [estado, acao] = useActionState(lancarDespesaFixa, ESTADO_INICIAL);
  const [ajustando, setAjustando] = useState(false);

  if (estado.sucesso) {
    return (
      <p
        className="px-5 py-3 text-sm border-t flex items-center gap-1.5"
        style={{ borderColor: "var(--borda)", color: "var(--positivo)" }}
      >
        <CircleCheck size={15} aria-hidden />
        {estado.sucesso}
      </p>
    );
  }

  return (
    <LinhaAcao className="px-5 py-3 border-t" style={{ borderColor: "var(--borda)" }}>
      <form action={acao} className="flex flex-wrap items-end justify-between gap-3">
        <input type="hidden" name="id" value={conta.id} />
        <input type="hidden" name="data_competencia" value={dataPadrao} />

        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{conta.descricao}</p>
          <p
            className="text-xs"
            style={{ color: atrasada ? "var(--selo)" : "var(--tinta-suave)" }}
          >
            {descreverVencimento(conta)}
            {atrasada && " · já passou"}
            {conta.categoria && ` · ${conta.categoria}`}
          </p>
        </div>

        <div className="flex items-end gap-2 shrink-0">
          {/* O previsto vai preenchido, mas dá para corrigir antes de lançar:
              luz e água mudam todo mês, e repetir o valor do cadastro faria
              o app divergir do extrato do banco. */}
          {ajustando ? (
            <div className="w-32">
              <CampoValor
                label="Veio quanto?"
                centavosIniciais={Math.round(Number(conta.valor) * 100)}
              />
            </div>
          ) : (
            <>
              <input
                type="hidden"
                name="valor"
                value={Number(conta.valor).toFixed(2)}
              />
              <button
                type="button"
                onClick={() => setAjustando(true)}
                className="valor text-sm underline"
                style={{ color: "var(--tinta-suave)" }}
                title="Veio outro valor este mês?"
              >
                {formatarMoeda(Number(conta.valor))}
              </button>
            </>
          )}

          <BotaoSubmit carregando="...">Lançar</BotaoSubmit>
        </div>
      </form>

      <div className="flex justify-end">
        <BotaoQueRemove
          acao={desativarDespesaFixa}
          id={conta.id}
          variante="discreto"
        >
          Não tenho mais essa conta
        </BotaoQueRemove>
      </div>

      <Aviso estado={estado} />
    </LinhaAcao>
  );
}

function FormularioNova({
  categorias,
  aoFechar,
}: {
  categorias: { id: string; nome: string }[];
  aoFechar: () => void;
}) {
  const [estado, acao] = useActionState(criarDespesaFixa, ESTADO_INICIAL);

  return (
    <form
      key={estado.sucesso ?? "nova"}
      action={acao}
      className="px-5 py-4 border-t flex flex-col gap-3"
      style={{ borderColor: "var(--borda)", background: "var(--papel)" }}
    >
      <div>
        <label className="rotulo" htmlFor="descricao-fixa">
          Que conta é essa?
        </label>
        <input
          id="descricao-fixa"
          name="descricao"
          required
          autoComplete="off"
          placeholder="Ex: internet da loja"
          className="campo"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <CampoValor label="Quanto costuma vir" />
        <div>
          <label className="rotulo" htmlFor="dia_vencimento">
            Vence dia
            <span className="dica"> (opcional)</span>
          </label>
          <input
            id="dia_vencimento"
            name="dia_vencimento"
            type="number"
            min={1}
            max={31}
            inputMode="numeric"
            placeholder="10"
            className="campo"
          />
        </div>
        <div>
          <label className="rotulo" htmlFor="categoria-fixa">
            Categoria
          </label>
          <select id="categoria-fixa" name="categoria_id" className="campo">
            <option value="">Sem categoria</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Aviso estado={estado} />

      <div className="flex justify-end gap-2">
        <button type="button" onClick={aoFechar} className="botao botao-secundario">
          Fechar
        </button>
        <BotaoSubmit carregando="Salvando...">Salvar conta fixa</BotaoSubmit>
      </div>
    </form>
  );
}
