"use client";

import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { gerarReciboDeOrcamento } from "@/app/actions/vendas";
import { ESTADO_INICIAL } from "@/app/actions/tipos";
import { Aviso } from "@/components/ui/campos";
import { BotaoSubmit } from "@/components/ui/botao-submit";

/**
 * Do orçamento aceito ao recibo, sem redigitar.
 *
 * O aceite fecha a venda; obrigar a pessoa a recriar item por item logo
 * depois é o tipo de atrito que faz o recibo não sair.
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
    <form action={acao} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <BotaoSubmit carregando="Emitindo...">
        Emitir recibo do orçamento #{numero}
        <ArrowRight size={15} aria-hidden />
      </BotaoSubmit>
      <Aviso estado={estado} />
    </form>
  );
}
