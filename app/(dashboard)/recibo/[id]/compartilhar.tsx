"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Lock, Share2, Sparkles } from "lucide-react";
import { compartilharDocumento } from "@/app/actions/marca";
import { ESTADO_INICIAL } from "@/app/actions/tipos";
import { Aviso } from "@/components/ui/campos";
import { BotaoSubmit } from "@/components/ui/botao-submit";
import { BotaoCopiar } from "@/components/ui/botao-copiar";

/**
 * Link do documento para mandar ao cliente.
 *
 * Imprimir e anexar PDF é fricção: o MEI resolve tudo por WhatsApp. Um link
 * que abre no celular do cliente, já com o PIX, encurta o caminho entre
 * entregar o serviço e receber por ele.
 */
export function Compartilhar({
  id,
  tokenExistente,
  liberado,
  ehOrcamento,
}: {
  id: string;
  tokenExistente: string | null;
  liberado: boolean;
  ehOrcamento: boolean;
}) {
  const [estado, acao] = useActionState(compartilharDocumento, ESTADO_INICIAL);

  if (!liberado) {
    return (
      <section className="mt-6 nao-imprimir rounded-lg border px-5 py-4" style={{ borderColor: "var(--borda)" }}>
        <p className="text-sm flex items-start gap-2" style={{ color: "var(--tinta-suave)" }}>
          <Lock size={15} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            No plano Pro, este documento vira um link para mandar no WhatsApp —
            o cliente abre no celular, vê tudo e paga pelo PIX ali mesmo
            {ehOrcamento ? ", ou aceita o orçamento com um toque" : ""}.
          </span>
        </p>
        <Link href="/planos" className="botao mt-3">
          <Sparkles size={15} aria-hidden />
          Ver o plano Pro
        </Link>
      </section>
    );
  }

  const token = tokenExistente ?? (estado.sucesso ?? null);

  if (token) {
    // Montado no navegador porque o servidor não conhece o domínio em que a
    // página está sendo servida.
    const url = typeof window === "undefined" ? "" : `${window.location.origin}/r/${token}`;
    const mensagem = encodeURIComponent(
      `Segue o ${ehOrcamento ? "orçamento" : "recibo"}: ${url}`
    );

    return (
      <section className="mt-6 nao-imprimir">
        <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--tinta-suave)" }}>
          Link para o cliente
        </p>
        <code className="brcode block mb-2">{url}</code>
        <div className="flex flex-wrap gap-2">
          <BotaoCopiar texto={url} rotulo="Copiar link" />
          <a
            href={`https://wa.me/?text=${mensagem}`}
            target="_blank"
            rel="noopener noreferrer"
            className="botao"
          >
            <Share2 size={15} aria-hidden />
            Mandar no WhatsApp
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-6 nao-imprimir">
      <form action={acao}>
        <input type="hidden" name="id" value={id} />
        <BotaoSubmit variante="secundario" carregando="Gerando...">
          <Share2 size={15} aria-hidden />
          Gerar link para o cliente
        </BotaoSubmit>
        <div className="mt-2">
          {estado.erro && <Aviso estado={estado} />}
        </div>
      </form>
    </section>
  );
}
