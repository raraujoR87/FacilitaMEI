"use client";

import { useActionState } from "react";
import { definirPlano, enviarResetDeSenha } from "@/app/actions/admin";
import { ESTADO_INICIAL } from "@/app/actions/tipos";
import { Aviso } from "@/components/ui/campos";
import { BotaoSubmit } from "@/components/ui/botao-submit";
import type { Tenant } from "@/lib/admin";

export function AcoesTenant({ tenant }: { tenant: Tenant }) {
  const [estadoPlano, acaoPlano] = useActionState(definirPlano, ESTADO_INICIAL);
  const [estadoSenha, acaoSenha] = useActionState(enviarResetDeSenha, ESTADO_INICIAL);

  return (
    <div className="mt-3 pt-3 border-t grid gap-4 md:grid-cols-2" style={{ borderColor: "var(--borda)" }}>
      <form action={acaoPlano} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="user_id" value={tenant.user_id} />
        <div>
          <label className="rotulo" htmlFor={`plano-${tenant.user_id}`}>
            Plano
          </label>
          <select
            id={`plano-${tenant.user_id}`}
            name="plano"
            defaultValue={tenant.plano}
            className="campo w-auto py-1.5"
          >
            <option value="free">free</option>
            <option value="pro">pro</option>
          </select>
        </div>
        <div>
          <label className="rotulo" htmlFor={`limite-${tenant.user_id}`}>
            Notas IA/mês
          </label>
          <input
            id={`limite-${tenant.user_id}`}
            name="limite_notas_mes"
            type="number"
            min={0}
            defaultValue={tenant.limite_notas_mes}
            className="campo w-24 py-1.5"
          />
        </div>
        <BotaoSubmit variante="secundario">Salvar</BotaoSubmit>
        <div className="w-full">
          <Aviso estado={estadoPlano} />
        </div>
      </form>

      <form action={acaoSenha} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="email" value={tenant.email ?? ""} />
        <div className="flex-1 min-w-[12rem]">
          <p className="rotulo">Acesso</p>
          <p className="dica">
            O link vai para o e-mail do cliente. Você nunca vê nem define a
            senha dele.
          </p>
        </div>
        <BotaoSubmit variante="secundario" carregando="Enviando...">
          Enviar redefinição de senha
        </BotaoSubmit>
        <div className="w-full">
          <Aviso estado={estadoSenha} />
        </div>
      </form>
    </div>
  );
}
