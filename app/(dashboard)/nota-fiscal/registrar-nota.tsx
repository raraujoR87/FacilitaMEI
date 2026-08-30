"use client";

import { useActionState, useState } from "react";
import { registrarNotaFiscal } from "@/app/actions/vendas";
import { ESTADO_INICIAL } from "@/app/actions/tipos";
import { Aviso } from "@/components/ui/campos";
import { BotaoSubmit } from "@/components/ui/botao-submit";

/**
 * Guarda o número da nota emitida fora do sistema.
 *
 * Fica recolhido por padrão: a lista existe para mostrar o que falta, e um
 * formulário aberto por linha viraria uma parede de campos.
 */
export function RegistrarNota({ id, documento }: { id: string; documento: string }) {
  const [estado, acao] = useActionState(registrarNotaFiscal, ESTADO_INICIAL);
  const [aberto, setAberto] = useState(false);

  if (estado.sucesso) {
    return (
      <p className="text-xs mt-2" style={{ color: "var(--positivo)" }}>
        {estado.sucesso}
      </p>
    );
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="botao botao-discreto px-0 mt-1"
      >
        Já emiti — registrar número
      </button>
    );
  }

  return (
    <form action={acao} className="mt-2 flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <div>
        <label className="rotulo" htmlFor={`nf-${id}`}>
          Número da {documento}
        </label>
        <input id={`nf-${id}`} name="nf_numero" required className="campo w-40 py-1.5" />
      </div>
      <div className="flex-1 min-w-[10rem]">
        <label className="rotulo" htmlFor={`link-${id}`}>
          Link
          <span className="dica"> (opcional)</span>
        </label>
        <input id={`link-${id}`} name="nf_link" type="url" className="campo py-1.5" />
      </div>
      <BotaoSubmit variante="secundario">Salvar</BotaoSubmit>
      <Aviso estado={estado} />
    </form>
  );
}
