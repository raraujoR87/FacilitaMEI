"use client";

import { useState } from "react";
import { formatarCentavos } from "@/lib/formato";

/**
 * Entrada de dinheiro com máscara em centavos.
 *
 * Digitar valor livre em pt-BR é ambíguo: "1.500" pode ser mil e quinhentos
 * ou um e meio, e errar isso num app financeiro é grave. Aqui o usuário só
 * digita dígitos, que preenchem o campo da direita para a esquerda — o
 * mesmo comportamento de maquininha de cartão. O valor numérico segue num
 * campo oculto, já sem ambiguidade.
 */
export function CampoValor({
  nome = "valor",
  label = "Valor",
  centavosIniciais = 0,
}: {
  nome?: string;
  label?: string;
  centavosIniciais?: number;
}) {
  const [centavos, setCentavos] = useState(centavosIniciais);

  function aoDigitar(evento: React.ChangeEvent<HTMLInputElement>) {
    const digitos = evento.target.value.replace(/\D/g, "").slice(0, 11);
    setCentavos(digitos === "" ? 0 : Number(digitos));
  }

  return (
    <div>
      <label className="rotulo" htmlFor={`${nome}-visivel`}>
        {label}
      </label>
      <div className="flex">
        <span
          className="inline-flex items-center px-2.5 text-sm rounded-l-md border border-r-0"
          style={{
            borderColor: "var(--borda)",
            background: "var(--papel-escuro)",
            color: "var(--tinta-suave)",
          }}
        >
          R$
        </span>
        <input
          id={`${nome}-visivel`}
          inputMode="numeric"
          autoComplete="off"
          value={formatarCentavos(centavos)}
          onChange={aoDigitar}
          onFocus={(e) => e.target.select()}
          className="campo campo-valor rounded-l-none"
        />
      </div>
      <input type="hidden" name={nome} value={(centavos / 100).toFixed(2)} />
    </div>
  );
}
