"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { CalendarClock, HandCoins, Wallet } from "lucide-react";
import { pagarDas, registrarRetirada } from "@/app/actions/caixa";
import { ESTADO_INICIAL } from "@/app/actions/tipos";
import { Aviso } from "@/components/ui/campos";
import { BotaoSubmit } from "@/components/ui/botao-submit";
import { CampoValor } from "@/components/ui/campo-valor";
import { formatarMoeda } from "@/lib/formato";
import type { AvisoDas, SituacaoDoCaixa } from "@/lib/caixa";

/**
 * "Quanto desse dinheiro é meu?"
 *
 * É a pergunta que faz o MEI misturar a conta pessoal com a do negócio: ele
 * olha o saldo do banco, não sabe quanto já tem dono, e tira no escuro.
 * Fica no topo do dashboard porque é o motivo de abrir o app.
 */
export function PainelCaixa({
  caixa,
  das,
  valorDas,
  fixasALancar,
}: {
  caixa: SituacaoDoCaixa;
  das: AvisoDas;
  valorDas: number | null;
  /** Contas fixas do mês ainda não lançadas. */
  fixasALancar: number;
}) {
  const [estadoRetirada, acaoRetirada] = useActionState(registrarRetirada, ESTADO_INICIAL);
  const [estadoDas, acaoDas] = useActionState(pagarDas, ESTADO_INICIAL);
  const [abrindoRetirada, setAbrindoRetirada] = useState(false);

  const negativo = caixa.disponivel < 0;
  const cor = negativo ? "var(--selo)" : "var(--positivo)";

  return (
    <section
      className="rounded-lg border px-5 py-5 mb-6"
      style={{ borderColor: "var(--borda)", background: "#fff" }}
    >
      <p className="text-sm font-medium flex items-center gap-1.5 mb-1">
        <Wallet size={15} style={{ color: cor }} aria-hidden />
        Quanto desse dinheiro é seu
      </p>

      <p className="valor text-3xl" style={{ color: cor }}>
        {formatarMoeda(caixa.disponivel)}
      </p>

      <p className="dica">
        {negativo
          ? "Você gastou mais do que entrou neste mês. Vale segurar retiradas até equilibrar."
          : "Depois de pagar o negócio e separar o imposto do mês."}
      </p>

      {/* O número acima só é honesto se as contas do mês já entraram. Conta
          fixa é a que mais fica de fora, porque ninguém guarda o boleto da
          internet — e a diferença aparece justamente no fim do mês. */}
      {fixasALancar > 0 && (
        <p className="dica" style={{ color: "var(--pendente)" }}>
          Faltam {formatarMoeda(fixasALancar)} em contas fixas.{" "}
          <Link href="/movimento" className="underline">
            Lançar agora
          </Link>{" "}
          para este valor ficar real.
        </p>
      )}

      {/* A conta aberta: sem ela o número parece mágica, e número mágico
          sobre dinheiro ninguém confia. */}
      <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-sm">
        <Linha rotulo="Entrou" valor={caixa.entradas} cor="var(--positivo)" />
        <Linha
          rotulo="Custos do negócio"
          valor={-(caixa.saidas - caixa.retiradas)}
          cor="var(--selo)"
        />
        <Linha rotulo="Você já tirou" valor={-caixa.retiradas} cor="var(--tinta-suave)" />
        <Linha
          rotulo="Imposto reservado"
          valor={-caixa.reservaDas}
          cor="var(--pendente)"
        />
      </dl>

      <div className="mt-4 pt-4 border-t flex flex-wrap items-center gap-2" style={{ borderColor: "var(--borda)" }}>
        {!abrindoRetirada ? (
          <button
            type="button"
            onClick={() => setAbrindoRetirada(true)}
            className="botao botao-secundario"
          >
            <HandCoins size={15} aria-hidden />
            Registrar retirada
          </button>
        ) : (
          <form action={acaoRetirada} className="flex flex-wrap items-end gap-2 w-full">
            <CampoValor label="Quanto você tirou" />
            <div className="flex-1 min-w-[10rem]">
              <label className="rotulo" htmlFor="descricao-retirada">
                Para quê
                <span className="dica"> (opcional)</span>
              </label>
              <input
                id="descricao-retirada"
                name="descricao"
                placeholder="Ex: pró-labore de agosto"
                autoComplete="off"
                className="campo"
              />
            </div>
            <BotaoSubmit>Registrar</BotaoSubmit>
            <button
              type="button"
              onClick={() => setAbrindoRetirada(false)}
              className="botao botao-secundario"
            >
              Cancelar
            </button>
            <div className="w-full">
              <Aviso estado={estadoRetirada} />
            </div>
          </form>
        )}

        {!caixa.dasInformado ? (
          <Link href="/configuracoes" className="botao botao-discreto px-0">
            Informar o valor do DAS
          </Link>
        ) : das.pago ? (
          <span className="text-sm flex items-center gap-1.5" style={{ color: "var(--positivo)" }}>
            <CalendarClock size={15} aria-hidden />
            DAS do mês pago
          </span>
        ) : (
          <form action={acaoDas} className="flex items-center gap-2">
            <input type="hidden" name="valor" value={String(valorDas ?? 0)} />
            <span
              className="text-sm flex items-center gap-1.5"
              style={{ color: das.urgente ? "var(--selo)" : "var(--tinta-suave)" }}
            >
              <CalendarClock size={15} aria-hidden />
              {das.dias === 0
                ? "DAS vence hoje"
                : `DAS vence em ${das.dias} dia${das.dias > 1 ? "s" : ""}`}
            </span>
            <BotaoSubmit variante="discreto" carregando="...">
              Já paguei
            </BotaoSubmit>
          </form>
        )}
      </div>

      <div className="mt-1">
        <Aviso estado={estadoDas} />
      </div>
    </section>
  );
}

function Linha({ rotulo, valor, cor }: { rotulo: string; valor: number; cor: string }) {
  return (
    <div>
      <dt className="text-xs" style={{ color: "var(--tinta-suave)" }}>
        {rotulo}
      </dt>
      <dd className="valor" style={{ color: valor === 0 ? "var(--tinta-suave)" : cor }}>
        {valor > 0 ? "+" : valor < 0 ? "−" : ""}
        {formatarMoeda(Math.abs(valor))}
      </dd>
    </div>
  );
}
