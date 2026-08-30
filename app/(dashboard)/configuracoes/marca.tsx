"use client";

import { useActionState, useState } from "react";
import { Lock, Sparkles } from "lucide-react";
import Link from "next/link";
import { atualizarMarca } from "@/app/actions/marca";
import { ESTADO_INICIAL } from "@/app/actions/tipos";
import { Aviso } from "@/components/ui/campos";
import { BotaoSubmit } from "@/components/ui/botao-submit";

export function MarcaDoNegocio({
  logoUrl,
  corMarca,
  liberado,
}: {
  logoUrl: string | null;
  corMarca: string | null;
  liberado: boolean;
}) {
  const [estado, acao] = useActionState(atualizarMarca, ESTADO_INICIAL);
  const [cor, setCor] = useState(corMarca ?? "#2F6E5B");

  if (!liberado) {
    return (
      <section className="fita-recibo px-6 py-6">
        <p className="text-xs uppercase tracking-widest" style={{ color: "var(--tinta-suave)" }}>
          Seu recibo com a sua marca
        </p>
        <p className="text-sm mt-2 flex items-start gap-2" style={{ color: "var(--tinta-suave)" }}>
          <Lock size={15} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            Seu logo e sua cor no recibo que o cliente recebe. É o que separa
            um comprovante de um documento de empresa.
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
    <form action={acao} className="fita-recibo px-6 py-6 flex flex-col gap-4">
      <div>
        <p className="text-xs uppercase tracking-widest" style={{ color: "var(--tinta-suave)" }}>
          Seu recibo com a sua marca
        </p>
        <p className="dica">Aparece no recibo impresso e no link que o cliente abre.</p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        {logoUrl && (
          <div>
            <p className="rotulo">Logo atual</p>
            {/* Vem do Storage, fora do domínio: o otimizador de imagem do
                Next exigiria configurar o host para pouca vantagem aqui. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
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
            name="logo"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="campo"
          />
          <p className="dica">PNG, JPG, WEBP ou SVG, até 2 MB.</p>
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

      {logoUrl && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="remover_logo" value="sim" />
          Remover o logo
        </label>
      )}

      <Aviso estado={estado} />

      <div className="flex justify-end">
        <BotaoSubmit>Salvar marca</BotaoSubmit>
      </div>
    </form>
  );
}
