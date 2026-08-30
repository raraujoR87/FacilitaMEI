"use client";

import { useActionState } from "react";
import { CircleCheck } from "lucide-react";
import { aceitarOrcamento } from "@/app/actions/publico";
import { ESTADO_INICIAL } from "@/app/actions/tipos";
import { Aviso } from "@/components/ui/campos";
import { BotaoSubmit } from "@/components/ui/botao-submit";

/**
 * Aceite do orçamento na própria tela do cliente.
 *
 * Fecha a venda sem ida e volta por mensagem: quem recebeu o link concorda
 * ali mesmo, e o MEI vê o aceite registrado com nome e data.
 */
export function AceitarOrcamento({
  token,
  aceitoPor,
  aceitoEm,
}: {
  token: string;
  aceitoPor: string | null;
  aceitoEm: string | null;
}) {
  const [estado, acao] = useActionState(aceitarOrcamento, ESTADO_INICIAL);

  if (aceitoEm || estado.sucesso) {
    return (
      <p
        className="mt-6 aviso aviso-sucesso flex items-start gap-2"
        role="status"
      >
        <CircleCheck size={16} className="mt-0.5 shrink-0" aria-hidden />
        <span>
          {aceitoPor
            ? `Orçamento aceito por ${aceitoPor} em ${new Date(aceitoEm!).toLocaleDateString("pt-BR")}.`
            : estado.sucesso}
        </span>
      </p>
    );
  }

  return (
    <form action={acao} className="mt-6 pt-5 border-t" style={{ borderColor: "var(--borda)" }}>
      <p className="text-sm font-medium mb-1">Concorda com este orçamento?</p>
      <p className="dica mb-3">
        Ao aceitar, quem enviou é avisado e pode começar o serviço.
      </p>

      <input type="hidden" name="token" value={token} />

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          name="nome"
          required
          placeholder="Seu nome completo"
          autoComplete="name"
          className="campo"
        />
        <BotaoSubmit carregando="Registrando...">Aceitar orçamento</BotaoSubmit>
      </div>

      <div className="mt-2">
        <Aviso estado={estado} />
      </div>
    </form>
  );
}
