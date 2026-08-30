import Link from "next/link";
import { CalendarClock, HandCoins, Wallet } from "lucide-react";
import { formatarMoeda } from "@/lib/formato";
import type { AvisoDas, SituacaoDoCaixa } from "@/lib/caixa";

/**
 * "Quanto desse dinheiro é meu?"
 *
 * É a pergunta que faz o MEI misturar a conta pessoal com a do negócio: ele
 * olha o saldo do banco, não sabe quanto já tem dono, e tira no escuro.
 * Fica no topo do dashboard porque é o motivo de abrir o app.
 *
 * O painel só LÊ. Ele já teve dois formulários dentro — registrar retirada
 * e dar baixa no DAS —, o que criava duas casas para o mesmo conceito:
 * quem aprendeu "saiu dinheiro, vou em Movimento" não achava a retirada, e
 * as duas telas tinham regras diferentes para o mesmo registro (a retirada
 * daqui, por exemplo, só aceitava a data de hoje). Agora a tela inicial
 * responde "como estou?" e leva para onde se registra.
 */
export function PainelCaixa({
  caixa,
  das,
  fixasALancar,
}: {
  caixa: SituacaoDoCaixa;
  das: AvisoDas;
  /** Contas fixas do mês ainda não lançadas. */
  fixasALancar: number;
}) {
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
        <Linha rotulo="Imposto reservado" valor={-caixa.reservaDas} cor="var(--pendente)" />
      </dl>

      <div
        className="mt-4 pt-4 border-t flex flex-wrap items-center gap-3"
        style={{ borderColor: "var(--borda)" }}
      >
        <Link href="/movimento?lancar=retirada" className="botao botao-secundario">
          <HandCoins size={15} aria-hidden />
          Registrar retirada
        </Link>

        {!caixa.dasInformado ? (
          <Link href="/configuracoes" className="botao botao-discreto px-0">
            Informar o valor do DAS
          </Link>
        ) : das.pago ? (
          <span
            className="text-sm flex items-center gap-1.5"
            style={{ color: "var(--positivo)" }}
          >
            <CalendarClock size={15} aria-hidden />
            DAS do mês pago
          </span>
        ) : (
          <Link
            href="/movimento?lancar=imposto"
            className="text-sm flex items-center gap-1.5 underline"
            style={{ color: das.urgente ? "var(--selo)" : "var(--tinta-suave)" }}
          >
            <CalendarClock size={15} aria-hidden />
            {das.dias === 0
              ? "DAS vence hoje — dar baixa"
              : `DAS vence em ${das.dias} dia${das.dias > 1 ? "s" : ""} — dar baixa`}
          </Link>
        )}
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
