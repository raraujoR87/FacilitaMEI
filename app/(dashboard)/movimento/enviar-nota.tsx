"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Estado =
  | { fase: "parado" }
  | { fase: "enviando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; mensagem: string };

export function EnviarNota() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({ fase: "parado" });

  async function enviar(evento: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    if (!arquivo) return;

    setEstado({ fase: "enviando" });

    const corpo = new FormData();
    corpo.append("arquivo", arquivo);

    try {
      const resposta = await fetch("/api/notas/upload", { method: "POST", body: corpo });
      const resultado = await resposta.json();

      if (!resposta.ok) {
        setEstado({ fase: "erro", mensagem: resultado.error ?? "Não foi possível ler a nota." });
        return;
      }

      setEstado({
        fase: "pronto",
        mensagem: `Lançado: ${resultado.lancamento.descricao}. Confira o valor e a categoria.`,
      });
      // A lista é renderizada no servidor; sem isso a nota nova não aparece.
      router.refresh();
    } catch {
      setEstado({ fase: "erro", mensagem: "Falha de conexão. Tente de novo." });
    } finally {
      evento.target.value = "";
    }
  }

  return (
    <div>
      <label className="botao botao-secundario cursor-pointer">
        {estado.fase === "enviando" ? "Lendo a nota..." : "Enviar foto da nota"}
        <input
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          className="hidden"
          onChange={enviar}
          disabled={estado.fase === "enviando"}
        />
      </label>

      {(estado.fase === "erro" || estado.fase === "pronto") && (
        <p
          className={`aviso mt-2 ${estado.fase === "erro" ? "aviso-erro" : "aviso-sucesso"}`}
          role="status"
        >
          {estado.mensagem}
        </p>
      )}
    </div>
  );
}
