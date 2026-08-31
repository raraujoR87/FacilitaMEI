"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { editarCliente, excluirCliente } from "@/app/actions/clientes";
import { Aviso } from "@/components/ui/campos";
import { BotaoSubmit } from "@/components/ui/botao-submit";
import { BotaoQueRemove, LinhaAcao } from "@/components/ui/linha-acao";
import { ArquivarCliente, CamposCliente, type ClienteEditavel } from "./formulario";

/**
 * Uma linha da carteira, com a edição embutida.
 *
 * A linha precisa ser dona do estado de edição — e não o botão de lápis.
 * Quando o formulário morava dentro da célula de ações (que é `shrink-0`,
 * para os valores não amassarem), o `w-full` dele empurrava a linha para
 * além da largura da tela: no celular, a página inteira ganhava rolagem
 * horizontal. Sendo dona do estado, a linha troca o resumo pelo formulário
 * em vez de tentar caber os dois lado a lado.
 */
export function LinhaCliente({
  cliente,
  situacao,
  detalhe,
  pago,
  aberto,
  podeExcluir,
}: {
  cliente: ClienteEditavel;
  situacao: { texto: string; cor: string };
  /** Segunda linha, já formatada no servidor. */
  detalhe: string;
  pago: string | null;
  aberto: string | null;
  /** Só quem nunca comprou; o resto é arquivado. */
  podeExcluir: boolean;
}) {
  const [editando, setEditando] = useState(false);

  if (editando) {
    return (
      <div className="py-4">
        <FormularioEdicao cliente={cliente} aoFechar={() => setEditando(false)} />
      </div>
    );
  }

  return (
    <LinhaAcao className="py-3 text-sm flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-start sm:gap-3">
      {/* No celular a linha empilha: lado a lado, o nome sobrava em
          "Transp..." e o valor em aberto invadia a linha do CPF. Cinco
          informações não cabem em 375px numa faixa só. */}
      <div className="min-w-0 sm:flex-1">
        <p className="font-medium truncate">
          {cliente.nome}{" "}
          <span className="text-xs font-normal" style={{ color: situacao.cor }}>
            · {situacao.texto}
          </span>
        </p>
        <p className="text-xs" style={{ color: "var(--tinta-suave)" }}>
          {detalhe}
        </p>
      </div>

      <div className="flex items-center justify-between gap-2 shrink-0 sm:items-start sm:justify-end">
        <div className="sm:text-right">
          {pago && (
            <p className="valor" style={{ color: "var(--positivo)" }}>
              {pago}
            </p>
          )}
          {aberto && (
            <p className="valor text-xs whitespace-nowrap" style={{ color: "var(--pendente)" }}>
              {aberto} em aberto
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setEditando(true)}
            aria-label={`Corrigir cadastro de ${cliente.nome}`}
            className="botao botao-discreto px-1"
          >
            <Pencil size={14} aria-hidden />
          </button>

          {/* Excluir de verdade só para quem nunca comprou: a chave
              estrangeira é `set null` e o recibo ficaria sem nome. Quem tem
              histórico é arquivado — e o banco recusa o contrário, por
              gatilho. */}
          {podeExcluir ? (
            <BotaoQueRemove acao={excluirCliente} id={cliente.id} variante="discreto">
              Excluir
            </BotaoQueRemove>
          ) : (
            <ArquivarCliente id={cliente.id} />
          )}
        </div>
      </div>
    </LinhaAcao>
  );
}

/**
 * Chama a ação direto em vez de `useActionState` para poder fechar sozinho
 * quando dá certo — com o estado do formulário, o sucesso ficaria preso na
 * tela e a pessoa teria que fechar na mão.
 */
function FormularioEdicao({
  cliente,
  aoFechar,
}: {
  cliente: ClienteEditavel;
  aoFechar: () => void;
}) {
  const [erro, setErro] = useState<string | undefined>();

  return (
    <form
      action={async (formData: FormData) => {
        const resultado = await editarCliente({}, formData);
        if (resultado.sucesso) aoFechar();
        else setErro(resultado.erro);
      }}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="id" value={cliente.id} />

      <CamposCliente cliente={cliente} />

      <Aviso estado={{ erro }} />

      <div className="flex flex-wrap gap-2 justify-end">
        <button type="button" onClick={aoFechar} className="botao botao-secundario">
          Cancelar
        </button>
        <BotaoSubmit>Salvar</BotaoSubmit>
      </div>
    </form>
  );
}
