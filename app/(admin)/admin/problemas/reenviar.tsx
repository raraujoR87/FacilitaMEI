"use client";

import { useActionState } from "react";
import { reenviarConfirmacao } from "@/app/actions/admin";
import { ESTADO_INICIAL } from "@/app/actions/tipos";
import { BotaoSubmit } from "@/components/ui/botao-submit";

export function ReenviarConfirmacao({ email }: { email: string }) {
  const [estado, acao] = useActionState(reenviarConfirmacao, ESTADO_INICIAL);

  return (
    <form action={acao} className="flex items-center gap-3 shrink-0">
      <input type="hidden" name="email" value={email} />
      {(estado.erro || estado.sucesso) && (
        <span
          className="text-xs"
          style={{ color: estado.erro ? "var(--selo)" : "var(--positivo)" }}
        >
          {estado.erro ?? "Reenviado ✓"}
        </span>
      )}
      <BotaoSubmit variante="secundario" carregando="Enviando...">
        Reenviar confirmação
      </BotaoSubmit>
    </form>
  );
}
