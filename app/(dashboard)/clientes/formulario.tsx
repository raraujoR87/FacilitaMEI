"use client";

import { useActionState, useState } from "react";
import { Pencil } from "lucide-react";
import {
  arquivarCliente,
  criarCliente,
  editarCliente,
  reativarCliente,
} from "@/app/actions/clientes";
import { ESTADO_INICIAL } from "@/app/actions/tipos";
import { Aviso, Campo } from "@/components/ui/campos";
import { BotaoSubmit } from "@/components/ui/botao-submit";
import { useMarcarSaindo } from "@/components/ui/linha-acao";

export type ClienteEditavel = {
  id: string;
  nome: string;
  documento: string | null;
  telefone: string | null;
  email: string | null;
  observacoes: string | null;
};

/**
 * Os mesmos campos no cadastro e na correção.
 *
 * Duplicar o formulário era o que fazia a edição nascer diferente do
 * cadastro — foi assim que a retirada acabou aceitando só a data de hoje
 * enquanto o custo aceitava qualquer uma.
 */
function CamposCliente({ cliente }: { cliente?: ClienteEditavel }) {
  return (
    <>
      <Campo nome="nome" label="Nome" obrigatorio valorInicial={cliente?.nome} />
      <Campo
        nome="documento"
        label="CPF ou CNPJ"
        inputMode="numeric"
        valorInicial={cliente?.documento}
        dica="É o que decide se a venda para este cliente exige nota fiscal."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          nome="telefone"
          label="Telefone"
          tipo="tel"
          inputMode="tel"
          valorInicial={cliente?.telefone}
        />
        <Campo
          nome="email"
          label="E-mail"
          tipo="email"
          inputMode="email"
          valorInicial={cliente?.email}
        />
      </div>
      <Campo
        nome="observacoes"
        label="Observações"
        valorInicial={cliente?.observacoes}
      />
    </>
  );
}

export function FormularioCliente() {
  const [estado, acao] = useActionState(criarCliente, ESTADO_INICIAL);

  return (
    <form
      key={estado.sucesso ?? "novo"}
      action={acao}
      className="fita-recibo px-6 py-6 mb-8 flex flex-col gap-4"
    >
      <CamposCliente />

      <Aviso estado={estado} />

      <div className="flex justify-end">
        <BotaoSubmit carregando="Salvando...">Cadastrar cliente</BotaoSubmit>
      </div>
    </form>
  );
}

/**
 * Correção do cadastro, recolhida na própria linha.
 *
 * Sem isto, um nome digitado errado ia para todo recibo emitido e não
 * havia como acrescentar o CPF/CNPJ depois — o campo que decide se a
 * venda exige nota fiscal.
 */
export function EditarCliente({ cliente }: { cliente: ClienteEditavel }) {
  const [estado, acao] = useActionState(editarCliente, ESTADO_INICIAL);
  const [aberto, setAberto] = useState(false);

  if (estado.sucesso) {
    return (
      <p className="text-xs" style={{ color: "var(--positivo)" }}>
        {estado.sucesso}
      </p>
    );
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label={`Corrigir cadastro de ${cliente.nome}`}
        className="botao botao-discreto px-1"
      >
        <Pencil size={14} aria-hidden />
      </button>
    );
  }

  return (
    <form action={acao} className="w-full mt-3 flex flex-col gap-3">
      <input type="hidden" name="id" value={cliente.id} />

      <CamposCliente cliente={cliente} />

      <Aviso estado={estado} />

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="botao botao-secundario"
        >
          Cancelar
        </button>
        <BotaoSubmit>Salvar</BotaoSubmit>
      </div>
    </form>
  );
}

/** Reativar pode esbarrar no limite do grátis, então precisa mostrar erro. */
export function ReativarCliente({ id }: { id: string }) {
  const [estado, acao] = useActionState(reativarCliente, ESTADO_INICIAL);

  return (
    <form action={acao} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <BotaoSubmit variante="discreto" carregando="...">
        Reativar
      </BotaoSubmit>
      <Aviso estado={estado} />
    </form>
  );
}

/**
 * Arquivar recusa quem tem cobrança em aberto, então precisa de espaço
 * para explicar o motivo — um botão mudo deixaria a pessoa achando que o
 * app travou.
 */
export function ArquivarCliente({ id }: { id: string }) {
  const [estado, acao] = useActionState(arquivarCliente, ESTADO_INICIAL);
  const marcarSaindo = useMarcarSaindo();

  return (
    <form
      action={(formData) => {
        marcarSaindo?.(undefined);
        acao(formData);
      }}
      className="flex flex-col items-end gap-1"
    >
      <input type="hidden" name="id" value={id} />
      <BotaoSubmit variante="discreto" carregando="...">
        Arquivar
      </BotaoSubmit>
      <Aviso estado={estado} />
    </form>
  );
}
