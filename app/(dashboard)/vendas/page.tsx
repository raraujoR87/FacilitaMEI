import { exigirUsuario } from "@/lib/auth";
import { cancelarDocumento, marcarComoPago } from "@/app/actions/vendas";
import { estaVencido, formatarData, formatarMoeda } from "@/lib/formato";
import { Carimbo, Recibo, Vazio } from "@/components/ui/campos";
import { BotaoSubmit } from "@/components/ui/botao-submit";
import { FormularioVenda } from "./formulario";

type Documento = {
  id: string;
  numero: number;
  tipo: "orcamento" | "recibo";
  descricao_servico: string;
  valor: number;
  status: "pendente" | "pago" | "cancelado";
  data_emissao: string;
  data_vencimento: string | null;
  clientes: { nome: string } | { nome: string }[] | null;
};

function nomeCliente(clientes: Documento["clientes"]): string | null {
  const c = Array.isArray(clientes) ? clientes[0] : clientes;
  return c?.nome ?? null;
}

export default async function VendasPage() {
  const { supabase, user } = await exigirUsuario();

  const [{ data: documentos }, { data: clientes }] = await Promise.all([
    supabase
      .from("documentos_venda")
      .select(
        "id, numero, tipo, descricao_servico, valor, status, data_emissao, data_vencimento, clientes(nome)"
      )
      .eq("user_id", user.id)
      .order("numero", { ascending: false })
      .limit(100),
    supabase.from("clientes").select("id, nome").eq("user_id", user.id).order("nome"),
  ]);

  const lista = (documentos ?? []) as Documento[];

  return (
    <div>
      <h1 className="text-2xl mb-6" style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}>
        Vendas
      </h1>

      <FormularioVenda clientes={clientes ?? []} />

      <Recibo titulo="Emitidos">
        {lista.length === 0 ? (
          <Vazio>Nenhum recibo ou orçamento emitido ainda.</Vazio>
        ) : (
          <div className="flex flex-col divide-y" style={{ borderColor: "var(--borda)" }}>
            {lista.map((d) => {
              const status =
                d.status === "pendente" && estaVencido(d.data_vencimento)
                  ? "vencido"
                  : d.status;

              return (
                <div key={d.id} className="flex justify-between items-start gap-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      #{d.numero} · {d.descricao_servico}
                    </p>
                    <p className="text-xs" style={{ color: "var(--tinta-suave)" }}>
                      {d.tipo === "recibo" ? "Recibo" : "Orçamento"} ·{" "}
                      {formatarData(d.data_emissao)}
                      {nomeCliente(d.clientes) && ` · ${nomeCliente(d.clientes)}`}
                      {d.data_vencimento && ` · vence ${formatarData(d.data_vencimento)}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="valor">{formatarMoeda(Number(d.valor))}</span>
                    <Carimbo status={status} />
                    {d.status === "pendente" && (
                      <div className="flex gap-1">
                        <form action={marcarComoPago}>
                          <input type="hidden" name="id" value={d.id} />
                          <BotaoSubmit variante="discreto" carregando="...">
                            Recebi
                          </BotaoSubmit>
                        </form>
                        <form action={cancelarDocumento}>
                          <input type="hidden" name="id" value={d.id} />
                          <BotaoSubmit variante="discreto" carregando="...">
                            Cancelar
                          </BotaoSubmit>
                        </form>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Recibo>
    </div>
  );
}
