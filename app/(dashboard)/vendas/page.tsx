"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Documento = {
  id: string;
  numero: number;
  tipo: "orcamento" | "recibo";
  descricao_servico: string;
  valor: number;
  status: "pendente" | "pago" | "cancelado";
  data_emissao: string;
};

export default function VendasPage() {
  const supabase = createClient();
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [tipo, setTipo] = useState<"orcamento" | "recibo">("recibo");
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    const { data } = await supabase
      .from("documentos_venda")
      .select("id, numero, tipo, descricao_servico, valor, status, data_emissao")
      .order("data_emissao", { ascending: false })
      .limit(50);
    setDocumentos(data ?? []);
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await supabase.from("documentos_venda").insert({
        user_id: user.id,
        tipo,
        descricao_servico: descricao,
        valor: Number(valor.replace(",", ".")),
      });
    }

    setSalvando(false);
    setDescricao("");
    setValor("");
    carregar();
  }

  return (
    <div>
      <h1
        className="text-2xl mb-6"
        style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}
      >
        Vendas
      </h1>

      <form
        onSubmit={handleSubmit}
        className="fita-recibo px-6 py-6 mb-8 grid gap-3 md:grid-cols-[1fr_140px_140px_auto] items-end"
      >
        <div>
          <label className="text-xs font-medium block mb-1">Descrição do serviço</label>
          <input
            required
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
            style={{ borderColor: "var(--borda)" }}
          />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Valor (R$)</label>
          <input
            required
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
            style={{ borderColor: "var(--borda)" }}
          />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Tipo</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as "orcamento" | "recibo")}
            className="w-full rounded-md border px-3 py-2 text-sm"
            style={{ borderColor: "var(--borda)" }}
          >
            <option value="recibo">Recibo</option>
            <option value="orcamento">Orçamento</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={salvando}
          className="rounded-md px-4 py-2 text-sm font-medium text-white"
          style={{ background: "var(--tinta)" }}
        >
          {salvando ? "Salvando..." : "Emitir"}
        </button>
      </form>

      <div className="fita-recibo px-6 py-6">
        {documentos.length === 0 ? (
          <p className="text-sm py-6 text-center" style={{ color: "var(--tinta-suave)" }}>
            Nenhum orçamento ou recibo emitido ainda.
          </p>
        ) : (
          <div className="flex flex-col divide-y" style={{ borderColor: "var(--borda)" }}>
            {documentos.map((d) => (
              <div key={d.id} className="flex justify-between items-center py-3 text-sm">
                <div>
                  <p className="font-medium">
                    #{d.numero} · {d.descricao_servico}
                  </p>
                  <p className="text-xs" style={{ color: "var(--tinta-suave)" }}>
                    {d.tipo === "recibo" ? "Recibo" : "Orçamento"} ·{" "}
                    {new Date(d.data_emissao).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span style={{ fontFamily: "var(--font-mono-valor)" }}>
                    R$ {Number(d.valor).toFixed(2)}
                  </span>
                  <span
                    className="carimbo"
                    style={{
                      color:
                        d.status === "pago"
                          ? "var(--positivo)"
                          : d.status === "cancelado"
                          ? "var(--tinta-suave)"
                          : "var(--pendente)",
                    }}
                  >
                    {d.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
