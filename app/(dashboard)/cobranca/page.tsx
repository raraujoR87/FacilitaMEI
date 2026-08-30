"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Pendente = {
  id: string;
  numero: number;
  descricao_servico: string;
  valor: number;
  data_vencimento: string | null;
};

export default function CobrancaPage() {
  const supabase = createClient();
  const [pendentes, setPendentes] = useState<Pendente[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("documentos_venda")
        .select("id, numero, descricao_servico, valor, data_vencimento")
        .eq("status", "pendente")
        .order("data_vencimento", { ascending: true });
      setPendentes(data ?? []);
    })();
  }, [supabase]);

  async function marcarComoPago(id: string) {
    await supabase.from("documentos_venda").update({ status: "pago" }).eq("id", id);
    setPendentes((atual) => atual.filter((p) => p.id !== id));
  }

  return (
    <div>
      <h1
        className="text-2xl mb-2"
        style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}
      >
        Cobrança
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--tinta-suave)" }}>
        Recebimentos pendentes. O lembrete automático via WhatsApp é
        configurado na integração — veja o README do projeto.
      </p>

      <div className="fita-recibo px-6 py-6">
        {pendentes.length === 0 ? (
          <p className="text-sm py-6 text-center" style={{ color: "var(--tinta-suave)" }}>
            Nenhuma cobrança pendente. Tudo em dia.
          </p>
        ) : (
          <div className="flex flex-col divide-y" style={{ borderColor: "var(--borda)" }}>
            {pendentes.map((p) => (
              <div key={p.id} className="flex justify-between items-center py-3 text-sm">
                <div>
                  <p className="font-medium">
                    #{p.numero} · {p.descricao_servico}
                  </p>
                  {p.data_vencimento && (
                    <p className="text-xs" style={{ color: "var(--tinta-suave)" }}>
                      Vence em {new Date(p.data_vencimento).toLocaleDateString("pt-BR")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span style={{ fontFamily: "var(--font-mono-valor)", color: "var(--pendente)" }}>
                    R$ {Number(p.valor).toFixed(2)}
                  </span>
                  <button
                    onClick={() => marcarComoPago(p.id)}
                    className="text-xs font-medium px-3 py-1.5 rounded-md border"
                    style={{ borderColor: "var(--borda)" }}
                  >
                    Marcar como pago
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
