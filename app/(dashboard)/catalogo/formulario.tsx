"use client";

import { useActionState, useState } from "react";
import { Briefcase, Package, Pencil, Plus } from "lucide-react";
import {
  arquivarItemCatalogo,
  criarItemCatalogo,
  editarItemCatalogo,
  reativarItemCatalogo,
} from "@/app/actions/catalogo";
import { ESTADO_INICIAL } from "@/app/actions/tipos";
import { Aviso } from "@/components/ui/campos";
import { BotaoSubmit } from "@/components/ui/botao-submit";
import { CampoValor } from "@/components/ui/campo-valor";
import { BotaoQueRemove, LinhaAcao } from "@/components/ui/linha-acao";
import { formatarMoeda } from "@/lib/formato";
import { margemDoItem, type ItemCatalogo } from "@/lib/catalogo";

const UNIDADES = ["un", "h", "kg", "m", "m²", "dia", "serviço"];

/** Os mesmos campos no cadastro e na correção, para não divergirem. */
function CamposItem({ item }: { item?: ItemCatalogo }) {
  const [natureza, setNatureza] = useState<"servico" | "produto">(
    item?.natureza ?? "servico"
  );

  return (
    <>
      <div>
        <p className="rotulo">O que é?</p>
        <div className="flex gap-2">
          {(
            [
              { id: "servico", rotulo: "Serviço", Icone: Briefcase },
              { id: "produto", rotulo: "Produto", Icone: Package },
            ] as const
          ).map(({ id, rotulo, Icone }) => (
            <label
              key={id}
              className="flex-1 flex items-center justify-center gap-1.5 text-sm py-2 rounded-md border cursor-pointer"
              style={{
                borderColor: natureza === id ? "var(--positivo)" : "var(--borda)",
                background: natureza === id ? "rgba(47,110,91,0.08)" : "transparent",
                fontWeight: natureza === id ? 600 : 400,
              }}
            >
              <input
                type="radio"
                name="natureza"
                value={id}
                checked={natureza === id}
                onChange={() => setNatureza(id)}
                className="sr-only"
              />
              <Icone size={15} aria-hidden />
              {rotulo}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="rotulo" htmlFor="nome">
          Nome
        </label>
        <input
          id="nome"
          name="nome"
          required
          defaultValue={item?.nome}
          autoComplete="off"
          placeholder={natureza === "servico" ? "Ex: Corte masculino" : "Ex: Camiseta P"}
          className="campo"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <CampoValor
          nome="preco"
          label="Você cobra"
          centavosIniciais={Math.round((item?.preco ?? 0) * 100)}
        />
        <CampoValor
          nome="custo"
          label="Te custa"
          centavosIniciais={Math.round((item?.custo ?? 0) * 100)}
        />
        <div>
          <label className="rotulo" htmlFor="unidade">
            Unidade
          </label>
          <select
            id="unidade"
            name="unidade"
            defaultValue={item?.unidade ?? "un"}
            className="campo"
          >
            {UNIDADES.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="dica">
        O custo é opcional, mas é ele que faz a margem aparecer sozinha em
        cada venda — sem precisar lançar despesa uma por uma.
      </p>
    </>
  );
}

export function NovoItem() {
  const [estado, acao] = useActionState(criarItemCatalogo, ESTADO_INICIAL);
  const [aberto, setAberto] = useState(false);

  if (!aberto) {
    return (
      <div className="mb-6">
        <button type="button" onClick={() => setAberto(true)} className="botao">
          <Plus size={15} aria-hidden />
          Novo item
        </button>
      </div>
    );
  }

  return (
    <form
      key={estado.sucesso ?? "novo"}
      action={acao}
      className="fita-recibo px-5 md:px-6 py-6 mb-6 flex flex-col gap-4"
    >
      <CamposItem />
      <Aviso estado={estado} />
      <div className="flex flex-wrap gap-2 justify-end">
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="botao botao-secundario"
        >
          Fechar
        </button>
        <BotaoSubmit carregando="Salvando...">Salvar item</BotaoSubmit>
      </div>
    </form>
  );
}

/**
 * Uma linha do catálogo, com a correção embutida.
 *
 * A linha é dona do estado de edição — e não o botão de lápis. É o mesmo
 * motivo da carteira de clientes: o formulário precisa da largura toda, e
 * dentro da célula de ações ele empurrava a linha para fora da tela.
 */
export function LinhaItem({ item }: { item: ItemCatalogo }) {
  const [editando, setEditando] = useState(false);
  const margem = margemDoItem(item);

  if (editando) {
    return (
      <div className="py-4">
        <FormularioEdicao item={item} aoFechar={() => setEditando(false)} />
      </div>
    );
  }

  return (
    <LinhaAcao className="py-3 text-sm flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-start sm:gap-3">
      <div className="min-w-0 sm:flex-1">
        <p className="font-medium truncate">
          {item.nome}{" "}
          <span className="text-xs font-normal" style={{ color: "var(--tinta-suave)" }}>
            · {item.natureza === "servico" ? "serviço" : "produto"} · por {item.unidade}
          </span>
        </p>
        <p className="text-xs" style={{ color: "var(--tinta-suave)" }}>
          {item.custo > 0
            ? `custa ${formatarMoeda(Number(item.custo))}`
            : "custo não informado"}
          {margem !== null && (
            <>
              {" · sobra "}
              <span style={{ color: margem < 0 ? "var(--selo)" : "var(--positivo)" }}>
                {margem.toLocaleString("pt-BR")}%
              </span>
            </>
          )}
        </p>
      </div>

      <div className="flex items-center justify-between gap-2 shrink-0 sm:items-start sm:justify-end">
        <p className="valor" style={{ color: "var(--positivo)" }}>
          {formatarMoeda(Number(item.preco))}
        </p>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setEditando(true)}
            aria-label={`Corrigir ${item.nome}`}
            className="botao botao-discreto px-1"
          >
            <Pencil size={14} aria-hidden />
          </button>
          <BotaoQueRemove acao={arquivarItemCatalogo} id={item.id} variante="discreto">
            Arquivar
          </BotaoQueRemove>
        </div>
      </div>
    </LinhaAcao>
  );
}

/**
 * Chama a ação direto em vez de `useActionState` para fechar sozinho
 * quando dá certo — com o estado do formulário, o sucesso ficaria preso na
 * tela e a pessoa teria que fechar na mão.
 */
function FormularioEdicao({
  item,
  aoFechar,
}: {
  item: ItemCatalogo;
  aoFechar: () => void;
}) {
  const [erro, setErro] = useState<string | undefined>();

  return (
    <form
      action={async (formData: FormData) => {
        const resultado = await editarItemCatalogo({}, formData);
        if (resultado.sucesso) aoFechar();
        else setErro(resultado.erro);
      }}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="id" value={item.id} />
      <CamposItem item={item} />
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

/** Reativar pode esbarrar no limite do grátis, então precisa mostrar erro. */
export function ReativarItem({ id }: { id: string }) {
  const [estado, acao] = useActionState(reativarItemCatalogo, ESTADO_INICIAL);

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
