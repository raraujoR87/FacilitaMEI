"use client";

import { useActionState, useState } from "react";
import { Eye, UserCheck } from "lucide-react";
import {
  gerarAcessoContador,
  revogarAcessoContador,
} from "@/app/actions/contador";
import { ESTADO_INICIAL } from "@/app/actions/tipos";
import { Aviso } from "@/components/ui/campos";
import { BotaoSubmit } from "@/components/ui/botao-submit";
import { BotaoCopiar } from "@/components/ui/botao-copiar";
import { formatarData, formatarMomento } from "@/lib/formato";

export type AcessoAtivo = {
  token: string;
  nome_contador: string | null;
  expira_em: string;
  ultimo_acesso_em: string | null;
  acessos: number;
};

/**
 * Link somente-leitura para o contador.
 *
 * O contador é o canal de distribuição natural do MEI — um atende dezenas.
 * Hoje o MEI baixa a planilha e manda por WhatsApp todo mês; o contador
 * recebe arquivo desencontrado e cobra pelo retrabalho.
 */
export function AcessoContador({
  acesso,
  origem,
}: {
  acesso: AcessoAtivo | null;
  /** Base da URL, montada no servidor: o link precisa existir sem JS. */
  origem: string;
}) {
  const [estado, acao] = useActionState(gerarAcessoContador, ESTADO_INICIAL);
  const [confirmando, setConfirmando] = useState(false);

  const url = acesso ? `${origem}/contador/${acesso.token}` : null;

  return (
    <section className="mb-6 nao-imprimir">
      <h2 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
        <UserCheck size={15} aria-hidden />
        Acesso do contador
      </h2>

      <div
        className="rounded-lg border px-5 py-4"
        style={{ borderColor: "var(--borda)", background: "#fff" }}
      >
        {url && acesso ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              {acesso.nome_contador ? (
                <>
                  Link ativo para <strong>{acesso.nome_contador}</strong>.
                </>
              ) : (
                "Link ativo."
              )}{" "}
              <span style={{ color: "var(--tinta-suave)" }}>
                Vale até {formatarData(acesso.expira_em.slice(0, 10))}.
              </span>
            </p>

            <code className="brcode block">{url}</code>
            <div className="flex flex-wrap gap-2">
              <BotaoCopiar texto={url} />
              <a
                href={`/contador/${acesso.token}`}
                target="_blank"
                rel="noopener noreferrer"
                className="botao botao-secundario"
              >
                <Eye size={15} aria-hidden />
                Ver como ele vê
              </a>
            </div>

            <p className="dica">
              {acesso.ultimo_acesso_em
                ? `Aberto ${acesso.acessos}x · último em ${formatarMomento(acesso.ultimo_acesso_em)}`
                : "Ainda não foi aberto."}
            </p>

            <div className="pt-3 border-t" style={{ borderColor: "var(--borda)" }}>
              {!confirmando ? (
                <button
                  type="button"
                  onClick={() => setConfirmando(true)}
                  className="botao botao-discreto px-0"
                >
                  Cancelar este acesso
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm">
                    O link para de funcionar na hora. Confirma?
                  </span>
                  <form action={revogarAcessoContador}>
                    <BotaoSubmit variante="secundario" carregando="...">
                      Cancelar acesso
                    </BotaoSubmit>
                  </form>
                  <button
                    type="button"
                    onClick={() => setConfirmando(false)}
                    className="botao botao-discreto"
                  >
                    Deixar como está
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <form action={acao} className="flex flex-col gap-3">
            <p className="text-sm" style={{ color: "var(--tinta-suave)" }}>
              Gere um link para o seu contador ver o que ele precisa para a
              declaração: receita do ano separada em comércio e serviços, mês a
              mês, e os recibos recebidos. Ele não precisa de senha, não altera
              nada e não vê suas retiradas.
            </p>

            <div className="sm:max-w-sm">
              <label className="rotulo" htmlFor="nome_contador">
                Nome do contador
                <span className="dica"> (opcional)</span>
              </label>
              <input
                id="nome_contador"
                name="nome_contador"
                autoComplete="off"
                placeholder="Ex: Contabilidade Silva"
                className="campo"
              />
              <p className="dica">Só para você lembrar de quem é o link.</p>
            </div>

            <Aviso estado={estado} />

            <div>
              <BotaoSubmit carregando="Gerando...">Gerar link</BotaoSubmit>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
