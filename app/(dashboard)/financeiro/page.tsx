"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useEffect } from "react";

type Lancamento = {
  id: string;
  descricao: string;
  valor: number;
  tipo: "receita" | "despesa";
  data_competencia: string;
  fornecedor_cliente: string | null;
};

export default function FinanceiroPage() {
  const supabase = createClient();
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  async function carregarLancamentos() {
    const { data } = await supabase
      .from("lancamentos")
      .select("id, descricao, valor, tipo, data_competencia, fornecedor_cliente")
      .order("data_competencia", { ascending: false })
      .limit(50);
    setLancamentos(data ?? []);
  }

  useEffect(() => {
    carregarLancamentos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;

    setEnviando(true);
    setMensagem(null);

    const formData = new FormData();
    formData.append("arquivo", arquivo);

    const resposta = await fetch("/api/notas/upload", {
      method: "POST",
      body: formData,
    });

    const resultado = await resposta.json();
    setEnviando(false);

    if (!resposta.ok) {
      setMensagem(resultado.error ?? "Não foi possível processar a nota.");
      return;
    }

    setMensagem("Nota lançada com sucesso.");
    carregarLancamentos();
    e.target.value = "";
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1
          className="text-2xl"
          style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}
        >
          Financeiro
        </h1>
        <label
          className="cursor-pointer text-sm font-medium px-4 py-2 rounded-md text-white"
          style={{ background: "var(--tinta)" }}
        >
          {enviando ? "Processando..." : "+ Lançar nota"}
          <input
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={handleUpload}
            disabled={enviando}
          />
        </label>
      </div>

      {mensagem && (
        <p className="text-sm mb-4" style={{ color: "var(--tinta-suave)" }}>
          {mensagem}
        </p>
      )}

      <div className="fita-recibo px-6 py-6">
        {lancamentos.length === 0 ? (
          <p className="text-sm py-6 text-center" style={{ color: "var(--tinta-suave)" }}>
            Nenhum lançamento ainda. Tire uma foto da nota ou manda pelo
            WhatsApp.
          </p>
        ) : (
          <div className="flex flex-col divide-y" style={{ borderColor: "var(--borda)" }}>
            {lancamentos.map((l) => (
              <div key={l.id} className="flex justify-between items-start py-3 text-sm">
                <div>
                  <p className="font-medium">{l.descricao}</p>
                  <p className="text-xs" style={{ color: "var(--tinta-suave)" }}>
                    {l.fornecedor_cliente ?? "—"} ·{" "}
                    {new Date(l.data_competencia).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <span
                  style={{
                    fontFamily: "var(--font-mono-valor)",
                    color: l.tipo === "receita" ? "var(--positivo)" : "var(--selo)",
                  }}
                >
                  {l.tipo === "receita" ? "+" : "-"}R${" "}
                  {Number(l.valor).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
