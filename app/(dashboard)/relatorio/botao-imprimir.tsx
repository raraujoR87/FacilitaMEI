"use client";

export function BotaoImprimir() {
  return (
    <button type="button" onClick={() => window.print()} className="botao">
      Imprimir / PDF
    </button>
  );
}
