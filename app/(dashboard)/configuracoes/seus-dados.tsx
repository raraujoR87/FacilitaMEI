"use client";

import { useActionState, useState } from "react";
import { Download, TriangleAlert } from "lucide-react";
import { excluirConta } from "@/app/actions/conta";
import { ESTADO_INICIAL } from "@/app/actions/tipos";
import { Aviso } from "@/components/ui/campos";
import { BotaoSubmit } from "@/components/ui/botao-submit";

/**
 * Direitos da LGPD como botão, não como pedido por e-mail.
 *
 * A exclusão fica atrás de uma confirmação digitada porque não há desfazer,
 * e recolhida porque ninguém precisa vê-la no caminho do uso normal.
 */
export function SeusDados() {
  const [estado, acao] = useActionState(excluirConta, ESTADO_INICIAL);
  const [aberto, setAberto] = useState(false);

  return (
    <section className="fita-recibo px-6 py-6 flex flex-col gap-4">
      <div>
        <p className="text-xs uppercase tracking-widest" style={{ color: "var(--tinta-suave)" }}>
          Seus dados
        </p>
        <p className="dica">
          Eles são seus. Leve embora ou apague quando quiser, sem precisar
          falar com a gente.
        </p>
      </div>

      <div>
        <a href="/api/meus-dados" download className="botao botao-secundario">
          <Download size={15} aria-hidden />
          Baixar tudo o que temos sobre você
        </a>
        <p className="dica mt-1">
          Perfil, clientes, lançamentos, recibos e itens, em arquivo aberto.
        </p>
      </div>

      <div className="pt-4 border-t" style={{ borderColor: "var(--borda)" }}>
        {!aberto ? (
          <button
            type="button"
            onClick={() => setAberto(true)}
            className="botao botao-discreto px-0"
          >
            Excluir minha conta
          </button>
        ) : (
          <form action={acao} className="flex flex-col gap-3">
            <p className="aviso aviso-erro flex items-start gap-2">
              <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
              <span>
                Isso apaga a conta e tudo que está nela — lançamentos, recibos,
                clientes e comprovantes. Não tem como desfazer. Se precisa dos
                documentos para o contador, baixe antes.
              </span>
            </p>

            <div className="sm:max-w-xs">
              <label className="rotulo" htmlFor="confirmacao">
                Digite EXCLUIR para confirmar
              </label>
              <input id="confirmacao" name="confirmacao" autoComplete="off" className="campo" />
            </div>

            <Aviso estado={estado} />

            <div className="flex gap-2">
              <BotaoSubmit carregando="Excluindo...">Excluir para sempre</BotaoSubmit>
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="botao botao-secundario"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
