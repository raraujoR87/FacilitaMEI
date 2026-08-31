"use client";

import { useState } from "react";
import { editarLancamento } from "@/app/actions/lancamentos";
import { Aviso } from "@/components/ui/campos";
import { BotaoSubmit } from "@/components/ui/botao-submit";
import { CampoValor } from "@/components/ui/campo-valor";

export type SaidaEditavel = {
  id: string;
  descricao: string;
  valor: number;
  data_competencia: string;
  fornecedor_cliente: string | null;
  categoria_id: string | null;
  custo_de_documento_id: string | null;
  natureza_saida: string | null;
};

/**
 * Correção de saída.
 *
 * Sem isto, um erro de digitação obrigava a excluir e relançar — e a
 * exclusão apaga o rastro, enquanto a edição fica registrada no histórico.
 *
 * Quem decide abrir e fechar é a linha, não este componente: o formulário
 * precisa da largura toda, e enquanto ele morava dentro da célula de ações
 * a linha estourava a tela no celular.
 */
export function FormularioEdicaoSaida({
  saida,
  categorias,
  trabalhos,
  aoFechar,
}: {
  saida: SaidaEditavel;
  categorias: { id: string; nome: string }[];
  trabalhos: { id: string; numero: number; descricao_servico: string }[];
  aoFechar: () => void;
}) {
  // Chama a ação direto em vez de `useActionState` para fechar sozinho
  // quando dá certo — com o estado do formulário, o sucesso ficaria preso
  // na tela e a pessoa teria que fechar na mão.
  const [erro, setErro] = useState<string | undefined>();

  // Categoria e vínculo com trabalho só existem no custo do negócio.
  // Mostrá-los numa retirada seria oferecer um campo que a ação ignora —
  // e o usuário só descobriria que não colou depois de salvar.
  const ehCusto = saida.natureza_saida === "custo";

  return (
    <form
      action={async (formData: FormData) => {
        const resultado = await editarLancamento({}, formData);
        if (resultado.sucesso) aoFechar();
        else setErro(resultado.erro);
      }}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="id" value={saida.id} />

      <input
        name="descricao"
        defaultValue={saida.descricao}
        required
        autoComplete="off"
        className="campo"
      />

      <div className={`grid gap-2 ${ehCusto ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        <CampoValor centavosIniciais={Math.round(Number(saida.valor) * 100)} />
        <div>
          <label className="rotulo text-xs">Data</label>
          <input
            name="data_competencia"
            type="date"
            defaultValue={saida.data_competencia.slice(0, 10)}
            className="campo"
          />
        </div>
        {ehCusto && (
          <div>
            <label className="rotulo text-xs">Categoria</label>
            <select name="categoria_id" defaultValue={saida.categoria_id ?? ""} className="campo">
              <option value="">Sem categoria</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <input
        name="fornecedor_cliente"
        defaultValue={saida.fornecedor_cliente ?? ""}
        placeholder="Fornecedor"
        autoComplete="off"
        className="campo"
      />

      {ehCusto && trabalhos.length > 0 && (
        <div>
          <label className="rotulo text-xs">Foi custo de qual trabalho?</label>
          <select
            name="custo_de_documento_id"
            defaultValue={saida.custo_de_documento_id ?? ""}
            className="campo"
          >
            <option value="">Gasto geral do negócio</option>
            {trabalhos.map((t) => (
              <option key={t.id} value={t.id}>
                #{t.numero} · {t.descricao_servico}
              </option>
            ))}
          </select>
        </div>
      )}

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
