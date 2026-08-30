import { exigirUsuario } from "@/lib/auth";
import { excluirCliente } from "@/app/actions/clientes";
import { formatarMoeda } from "@/lib/formato";
import { Recibo, Vazio } from "@/components/ui/campos";
import { BotaoSubmit } from "@/components/ui/botao-submit";
import { FormularioCliente } from "./formulario";

type Cliente = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  observacoes: string | null;
};

export default async function ClientesPage() {
  const { supabase, user } = await exigirUsuario();

  const [{ data: clientes }, { data: documentos }] = await Promise.all([
    supabase
      .from("clientes")
      .select("id, nome, telefone, email, observacoes")
      .eq("user_id", user.id)
      .order("nome"),
    supabase
      .from("documentos_venda")
      .select("cliente_id, valor, status")
      .eq("user_id", user.id)
      .eq("status", "pago"),
  ]);

  // Quanto cada cliente já rendeu — o dado que decide quem vale a pena
  // atender de novo.
  const totalPorCliente = new Map<string, number>();
  for (const d of documentos ?? []) {
    if (!d.cliente_id) continue;
    totalPorCliente.set(
      d.cliente_id,
      (totalPorCliente.get(d.cliente_id) ?? 0) + Number(d.valor)
    );
  }

  const lista = (clientes ?? []) as Cliente[];

  return (
    <div>
      <h1 className="text-2xl mb-6" style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}>
        Clientes
      </h1>

      <FormularioCliente />

      <Recibo titulo={`Cadastrados · ${lista.length}`}>
        {lista.length === 0 ? (
          <Vazio>
            Nenhum cliente cadastrado. Cadastrar aqui permite vincular recibos e
            cobranças a cada pessoa.
          </Vazio>
        ) : (
          <div className="flex flex-col divide-y" style={{ borderColor: "var(--borda)" }}>
            {lista.map((c) => (
              <div key={c.id} className="flex justify-between items-start gap-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">{c.nome}</p>
                  <p className="text-xs" style={{ color: "var(--tinta-suave)" }}>
                    {[c.telefone, c.email, c.observacoes].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {totalPorCliente.has(c.id) && (
                    <span className="valor" style={{ color: "var(--positivo)" }}>
                      {formatarMoeda(totalPorCliente.get(c.id)!)}
                    </span>
                  )}
                  <form action={excluirCliente}>
                    <input type="hidden" name="id" value={c.id} />
                    <BotaoSubmit variante="discreto" carregando="...">
                      Excluir
                    </BotaoSubmit>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </Recibo>
    </div>
  );
}
