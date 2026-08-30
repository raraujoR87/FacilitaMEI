"use client";

import { useActionState } from "react";
import { criarCliente } from "@/app/actions/clientes";
import { ESTADO_INICIAL } from "@/app/actions/tipos";
import { Aviso, Campo } from "@/components/ui/campos";
import { BotaoSubmit } from "@/components/ui/botao-submit";

export function FormularioCliente() {
  const [estado, acao] = useActionState(criarCliente, ESTADO_INICIAL);

  return (
    <form
      key={estado.sucesso ?? "novo"}
      action={acao}
      className="fita-recibo px-6 py-6 mb-8 flex flex-col gap-4"
    >
      <Campo nome="nome" label="Nome" obrigatorio />
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo nome="telefone" label="Telefone" tipo="tel" inputMode="tel" />
        <Campo nome="email" label="E-mail" tipo="email" inputMode="email" />
      </div>
      <Campo nome="observacoes" label="Observações" />

      <Aviso estado={estado} />

      <div className="flex justify-end">
        <BotaoSubmit carregando="Salvando...">Cadastrar cliente</BotaoSubmit>
      </div>
    </form>
  );
}
