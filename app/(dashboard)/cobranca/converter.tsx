"use client";

import { useActionState } from "react";
import { ArrowRight, HandCoins, Wallet } from "lucide-react";
import { gerarReciboDeOrcamento } from "@/app/actions/vendas";
import { ESTADO_INICIAL } from "@/app/actions/tipos";
import { Aviso } from "@/components/ui/campos";
import { BotaoSubmit } from "@/components/ui/botao-submit";

/**
 * Do orçamento aceito ao recibo, sem redigitar.
 *
 * O aceite fecha a venda; obrigar a pessoa a recriar item por item logo
 * depois é o tipo de atrito que faz o recibo não sair.
 *
 * São dois caminhos porque aceite e pagamento não acontecem juntos:
 *
 * - Incluir no movimento: o cliente já pagou. Esse é o caminho comum — o
 *   MEI costuma voltar ao app depois de receber, não na hora do aceite.
 * - Gerar cobrança: aceitou e ainda vai pagar. Fica em "A receber".
 *
 * O primeiro tem destaque porque é o que mais acontece, mas os dois
 * precisam existir: forçar tudo por "a receber" obrigaria a dar baixa em
 * seguida, e forçar tudo por "pago" mentiria sobre dinheiro que não
 * entrou.
 */
export function ConverterOrcamento({ id, numero }: { id: string; numero: number }) {
  const [estado, acao] = useActionState(gerarReciboDeOrcamento, ESTADO_INICIAL);

  if (estado.sucesso) {
    return (
      <p className="text-sm" style={{ color: "var(--positivo)" }}>
        {estado.sucesso}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <form action={acao}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="pago" value="sim" />
          <BotaoSubmit carregando="Incluindo...">
            <Wallet size={15} aria-hidden />
            Incluir no movimento
            <ArrowRight size={15} aria-hidden />
          </BotaoSubmit>
        </form>

        <form action={acao}>
          <input type="hidden" name="id" value={id} />
          <BotaoSubmit variante="secundario" carregando="Emitindo...">
            <HandCoins size={15} aria-hidden />
            Ainda vai pagar
          </BotaoSubmit>
        </form>
      </div>

      <p className="dica">
        Incluir no movimento registra o orçamento #{numero} como recebido:
        o dinheiro entra no caixa hoje. Dá para corrigir valores depois.
      </p>

      <Aviso estado={estado} />
    </div>
  );
}
