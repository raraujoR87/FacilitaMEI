"use client";

import { useState } from "react";
import { formatarCentavos } from "@/lib/formato";

export type TipoDesconto = "valor" | "percentual";

/**
 * Desconto em reais ou em percentual.
 *
 * Quem negocia fala nas duas moedas: "tiro 10%" e "faço por 500 a menos".
 * Obrigar a converter de cabeça na hora de fechar é onde entra erro de
 * conta — e num documento de preço, erro de conta é o que o cliente vê.
 *
 * A escolha vai junto no formulário porque o percentual precisa ser
 * guardado como intenção: mudando os itens depois, "10%" acompanha, e um
 * valor fixo não.
 */
export function CampoDesconto({
  tipoInicial = "valor",
  valorInicial = 0,
  percentualInicial = null,
}: {
  tipoInicial?: TipoDesconto;
  /** Em reais. */
  valorInicial?: number;
  percentualInicial?: number | null;
}) {
  const [tipo, setTipo] = useState<TipoDesconto>(tipoInicial);
  const [centavos, setCentavos] = useState(Math.round(valorInicial * 100));
  const [percentual, setPercentual] = useState(
    percentualInicial ? String(percentualInicial).replace(".", ",") : ""
  );

  const ehPercentual = tipo === "percentual";

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label className="rotulo" htmlFor="desconto-visivel">
          Desconto
          <span className="dica"> (opcional)</span>
        </label>

        <div className="flex gap-1" role="group" aria-label="Tipo de desconto">
          {(
            [
              { id: "valor", rotulo: "R$" },
              { id: "percentual", rotulo: "%" },
            ] as const
          ).map(({ id, rotulo }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTipo(id)}
              aria-pressed={tipo === id}
              className="text-xs px-2 py-0.5 rounded border"
              style={{
                borderColor: tipo === id ? "var(--tinta)" : "var(--borda)",
                background: tipo === id ? "var(--tinta)" : "transparent",
                color: tipo === id ? "#fff" : "var(--tinta-suave)",
                fontWeight: tipo === id ? 600 : 400,
              }}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </div>

      <div className="flex">
        <span
          className="inline-flex items-center px-2.5 text-sm rounded-l-md border border-r-0"
          style={{
            borderColor: "var(--borda)",
            background: "var(--papel-escuro)",
            color: "var(--tinta-suave)",
          }}
        >
          {ehPercentual ? "%" : "R$"}
        </span>

        {ehPercentual ? (
          <input
            id="desconto-visivel"
            inputMode="decimal"
            autoComplete="off"
            value={percentual}
            onChange={(e) => {
              // Só dígitos e uma vírgula: "10", "7,5". Ponto vira vírgula
              // porque o teclado numérico do celular oferece ponto.
              const limpo = e.target.value
                .replace(".", ",")
                .replace(/[^\d,]/g, "")
                .replace(/,(?=.*,)/g, "");
              const numero = Number(limpo.replace(",", "."));
              if (limpo === "" || (Number.isFinite(numero) && numero <= 100)) {
                setPercentual(limpo);
              }
            }}
            placeholder="10"
            className="campo campo-valor rounded-l-none"
          />
        ) : (
          <input
            id="desconto-visivel"
            inputMode="numeric"
            autoComplete="off"
            value={formatarCentavos(centavos)}
            onChange={(e) => {
              const digitos = e.target.value.replace(/\D/g, "").slice(0, 11);
              setCentavos(digitos === "" ? 0 : Number(digitos));
            }}
            onFocus={(e) => e.target.select()}
            className="campo campo-valor rounded-l-none"
          />
        )}
      </div>

      {/* Só um dos dois é enviado. Mandar os dois deixaria o servidor
          adivinhando qual vale, e a intenção é justamente o que se quer
          guardar. */}
      <input type="hidden" name="desconto_tipo" value={tipo} />
      <input
        type="hidden"
        name="desconto"
        value={ehPercentual ? "" : (centavos / 100).toFixed(2)}
      />
      <input
        type="hidden"
        name="desconto_percentual"
        value={ehPercentual ? percentual.replace(",", ".") : ""}
      />

      <p className="dica">
        {ehPercentual
          ? "Em %, o desconto acompanha se você mexer nos itens depois."
          : "Valor fixo, abatido do subtotal."}
      </p>
    </div>
  );
}
