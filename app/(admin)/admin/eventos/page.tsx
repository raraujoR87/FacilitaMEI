import { exigirAdministrador, formatarMomento, type EventoAuth } from "@/lib/admin";
import { Recibo, Vazio } from "@/components/ui/campos";

/** Nomes técnicos do GoTrue e dos marcos derivados, em português de operação. */
const ACOES: Record<string, { rotulo: string; cor: string }> = {
  conta_criada: { rotulo: "Criou conta", cor: "var(--positivo)" },
  email_confirmado: { rotulo: "Confirmou e-mail", cor: "var(--positivo)" },
  ultimo_acesso: { rotulo: "Último acesso", cor: "var(--tinta)" },
  login: { rotulo: "Entrou", cor: "var(--positivo)" },
  logout: { rotulo: "Saiu", cor: "var(--tinta-suave)" },
  user_signedup: { rotulo: "Criou conta", cor: "var(--positivo)" },
  user_confirmation_requested: { rotulo: "Pediu confirmação", cor: "var(--pendente)" },
  user_recovery_requested: { rotulo: "Pediu nova senha", cor: "var(--pendente)" },
  user_updated_password: { rotulo: "Trocou a senha", cor: "var(--positivo)" },
  user_modified: { rotulo: "Alterou a conta", cor: "var(--tinta-suave)" },
  user_deleted: { rotulo: "Conta removida", cor: "var(--selo)" },
  login_failed: { rotulo: "Falha no login", cor: "var(--selo)" },
};

export default async function AdminEventosPage() {
  const { supabase } = await exigirAdministrador();

  const { data, error } = await supabase.rpc("admin_eventos", { limite: 200 });
  const eventos = (data ?? []) as EventoAuth[];
  const daAuditoria = eventos.filter((e) => e.origem === "auditoria").length;

  return (
    <div>
      <h1 className="text-2xl mb-2" style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}>
        Linha do tempo de acesso
      </h1>
      <p className="dica mb-6">
        Cobre entrada nas contas e marcos de cadastro — não registra o que cada
        cliente faz dentro do próprio financeiro.
        {daAuditoria === 0 && (
          <>
            {" "}
            A auditoria detalhada do Supabase (<code>auth.audit_log_entries</code>)
            está vazia neste projeto: o Auth hospedado não a alimenta. Os marcos
            abaixo vêm de <code>auth.users</code>, que é sempre confiável.
          </>
        )}
      </p>

      {error && (
        <p className="aviso aviso-erro mb-6">Não foi possível carregar: {error.message}</p>
      )}

      {eventos.length === 0 ? (
        <Recibo>
          <Vazio>Nenhum evento registrado ainda.</Vazio>
        </Recibo>
      ) : (
        <div
          className="rounded-lg border overflow-x-auto"
          style={{ borderColor: "var(--borda)", background: "#fff" }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: "var(--tinta-suave)" }}>
                <th className="text-left font-medium px-4 py-2">Quando</th>
                <th className="text-left font-medium px-4 py-2">Evento</th>
                <th className="text-left font-medium px-4 py-2">Conta</th>
                <th className="text-left font-medium px-4 py-2">IP</th>
                <th className="text-left font-medium px-4 py-2">Fonte</th>
              </tr>
            </thead>
            <tbody>
              {eventos.map((e, i) => {
                const acao = e.acao ? ACOES[e.acao] : undefined;
                return (
                  <tr
                    key={`${e.ator_id}-${e.acao}-${e.ocorrido_em}-${i}`}
                    className="border-t"
                    style={{ borderColor: "var(--borda)" }}
                  >
                    <td className="px-4 py-2 whitespace-nowrap valor">
                      {formatarMomento(e.ocorrido_em)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap" style={{ color: acao?.cor }}>
                      {acao?.rotulo ?? e.acao ?? "—"}
                    </td>
                    <td className="px-4 py-2">{e.ator_email ?? "—"}</td>
                    <td className="px-4 py-2 valor" style={{ color: "var(--tinta-suave)" }}>
                      {e.ip ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-xs" style={{ color: "var(--tinta-suave)" }}>
                      {e.origem === "auditoria" ? "auditoria" : "derivado"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
