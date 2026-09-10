"use client";

import { useActionState, useRef, useState } from "react";
import { Lock, Sparkles, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { atualizarMarca } from "@/app/actions/marca";
import { ESTADO_INICIAL } from "@/app/actions/tipos";
import { Aviso } from "@/components/ui/campos";
import { BotaoSubmit } from "@/components/ui/botao-submit";
import { arquivoParaPng, urlParaPng } from "@/lib/imagem-cliente";

/**
 * Logo e cor nos documentos.
 *
 * O logo é convertido para PNG aqui, no navegador, antes de subir. O
 * upload aceita WebP e SVG porque é o que a pessoa tem em mãos, mas o
 * gerador de PDF só embute PNG e JPG — e um logo WebP sumia do orçamento
 * sem erro nenhum, só não aparecia.
 */
export function MarcaDoNegocio({
  logoUrl,
  corMarca,
  liberado,
  /** Formato do logo já guardado; diferente de PNG/JPG não entra no PDF. */
  logoCabeNoPdf,
}: {
  logoUrl: string | null;
  corMarca: string | null;
  liberado: boolean;
  logoCabeNoPdf: boolean;
}) {
  const [estado, acao] = useActionState(atualizarMarca, ESTADO_INICIAL);
  const [cor, setCor] = useState(corMarca ?? "#2F6E5B");
  const [png, setPng] = useState("");
  const [previa, setPrevia] = useState<string | null>(null);
  const [erroImagem, setErroImagem] = useState<string | null>(null);
  const [convertendo, setConvertendo] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    setErroImagem(null);
    if (!arquivo) {
      setPng("");
      setPrevia(null);
      return;
    }

    try {
      const convertido = await arquivoParaPng(arquivo);
      setPng(convertido);
      setPrevia(convertido);
    } catch {
      setErroImagem(
        "Não deu para ler essa imagem. Tente um PNG ou JPG salvo do seu computador."
      );
      setPng("");
      setPrevia(null);
    }
  }

  /** Conserta quem enviou o logo antes desta conversão existir. */
  async function converterOAtual() {
    if (!logoUrl) return;
    setConvertendo(true);
    setErroImagem(null);
    try {
      const convertido = await urlParaPng(logoUrl);
      setPng(convertido);
      setPrevia(convertido);
      formRef.current?.requestSubmit();
    } catch {
      setErroImagem(
        "Não deu para converter o logo atual. Envie o arquivo de novo pelo campo abaixo."
      );
    } finally {
      setConvertendo(false);
    }
  }

  if (!liberado) {
    return (
      <section className="fita-recibo px-6 py-6">
        <p className="text-xs uppercase tracking-widest" style={{ color: "var(--tinta-suave)" }}>
          Seus documentos com a sua marca
        </p>
        <p className="text-sm mt-2 flex items-start gap-2" style={{ color: "var(--tinta-suave)" }}>
          <Lock size={15} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            Seu logo e sua cor no recibo e no orçamento que o cliente recebe.
            É o que separa um comprovante de um documento de empresa.
          </span>
        </p>
        <Link href="/planos" className="botao mt-4">
          <Sparkles size={15} aria-hidden />
          Ver o plano Pro
        </Link>
      </section>
    );
  }

  return (
    <form ref={formRef} action={acao} className="fita-recibo px-6 py-6 flex flex-col gap-4">
      <div>
        <p className="text-xs uppercase tracking-widest" style={{ color: "var(--tinta-suave)" }}>
          Seus documentos com a sua marca
        </p>
        <p className="dica">
          Aparece no cabeçalho do orçamento em PDF, no recibo impresso e no
          link que o cliente abre.
        </p>
      </div>

      {/* O logo antigo em WebP ou SVG não entra no PDF. Em vez de mandar a
          pessoa procurar o arquivo original, converte o que já está lá. */}
      {logoUrl && !logoCabeNoPdf && !png && (
        <div
          className="rounded-md border px-4 py-3 flex flex-wrap items-center gap-3"
          style={{ borderColor: "var(--pendente)", background: "rgba(217,164,65,0.10)" }}
        >
          <TriangleAlert size={16} aria-hidden style={{ color: "var(--pendente)" }} />
          <p className="text-sm flex-1 min-w-[14rem]">
            Seu logo está num formato que não entra no PDF do orçamento.
            Converter resolve sem você precisar procurar o arquivo.
          </p>
          <button
            type="button"
            onClick={converterOAtual}
            disabled={convertendo}
            className="botao botao-secundario"
          >
            {convertendo ? "Convertendo..." : "Converter agora"}
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-4">
        {(previa ?? logoUrl) && (
          <div>
            <p className="rotulo">{previa ? "Novo logo" : "Logo atual"}</p>
            {/* Vem do Storage, fora do domínio: o otimizador de imagem do
                Next exigiria configurar o host para pouca vantagem aqui. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previa ?? logoUrl!}
              alt="Logo do negócio"
              className="max-h-14 object-contain border rounded-md p-1"
              style={{ borderColor: "var(--borda)" }}
            />
          </div>
        )}

        <div className="flex-1 min-w-[14rem]">
          <label className="rotulo" htmlFor="logo">
            {logoUrl ? "Trocar logo" : "Enviar logo"}
          </label>
          <input
            id="logo"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={aoEscolher}
            className="campo"
          />
          <p className="dica">
            PNG, JPG, WEBP ou SVG. Convertemos para PNG na hora do envio.
          </p>
        </div>

        <div>
          <label className="rotulo" htmlFor="cor_marca">
            Cor de destaque
          </label>
          <div className="flex items-center gap-2">
            <input
              id="cor_marca"
              name="cor_marca"
              type="color"
              value={cor}
              onChange={(e) => setCor(e.target.value)}
              className="h-10 w-14 rounded-md border cursor-pointer"
              style={{ borderColor: "var(--borda)" }}
            />
            <span className="valor text-xs" style={{ color: "var(--tinta-suave)" }}>
              {cor.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* O arquivo em si não é enviado: vai o PNG já convertido. */}
      <input type="hidden" name="logo_png" value={png} />

      {logoUrl && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="remover_logo" value="sim" />
          Remover o logo
        </label>
      )}

      {erroImagem && <p className="aviso aviso-erro">{erroImagem}</p>}
      <Aviso estado={estado} />

      <div className="flex justify-end">
        <BotaoSubmit>Salvar marca</BotaoSubmit>
      </div>
    </form>
  );
}
