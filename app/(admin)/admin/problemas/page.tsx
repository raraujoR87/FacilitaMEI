import {
  exigirAdministrador,
  formatarMomento,
  type ContaComProblema,
} from "@/lib/admin";
import { Recibo, Vazio } from "@/components/ui/campos";
import { ReenviarConfirmacao } from "./reenviar";

const ROTULOS: Record<ContaComProblema["problema"], { titulo: string; cor: string }> = {
  email_nao_confirmado: { titulo: "E-mail não confirmado", cor: "var(--pendente)" },
  sem_perfil: { titulo: "Conta sem perfil", cor: "var(--selo)" },
  nunca_acessou: { titulo: "Nunca acessou", cor: "var(--tinta-suave)" },
  bloqueado: { titulo: "Conta bloqueada", cor: "var(--selo)" },
};

export default async function AdminProblemasPage() {
  const { supabase } = await exigirAdministrador();

  const { data, error } = await supabase.rpc("admin_contas_com_problema");
  const contas = (data ?? []) as ContaComProblema[];

  const porTipo = new Map<ContaComProblema["problema"], ContaComProblema[]>();
  for (const conta of contas) {
    porTipo.set(conta.problema, [...(porTipo.get(conta.problema) ?? []), conta]);
  }

  return (
    <div>
      <h1 className="text-2xl mb-2" style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}>
        Problemas de cadastro
      </h1>
      <p className="dica mb-6">
        Contas que travaram antes de começar a usar o produto. `sem_perfil`
        indica falha do gatilho de criação — é o único caso aqui que aponta
        defeito nosso, e não abandono do cliente.
      </p>

      {error && (
        <p className="aviso aviso-erro mb-6">Não foi possível carregar: {error.message}</p>
      )}

      {contas.length === 0 ? (
        <Recibo>
          <Vazio>Nenhuma conta travada. Todos os cadastros concluíram.</Vazio>
        </Recibo>
      ) : (
        <div className="flex flex-col gap-6">
          {[...porTipo.entries()].map(([problema, lista]) => (
            <section key={problema}>
              <h2 className="text-sm font-semibold mb-2" style={{ color: ROTULOS[problema].cor }}>
                {ROTULOS[problema].titulo} · {lista.length}
              </h2>

              <div className="rounded-lg border divide-y" style={{ borderColor: "var(--borda)", background: "#fff" }}>
                {lista.map((conta) => (
                  <div
                    key={`${conta.problema}-${conta.user_id}`}
                    className="px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate">{conta.email ?? "sem e-mail"}</p>
                      <p className="text-xs" style={{ color: "var(--tinta-suave)" }}>
                        {conta.detalhe} · cadastro em {formatarMomento(conta.criado_em)}
                      </p>
                    </div>

                    {problema === "email_nao_confirmado" && conta.email && (
                      <ReenviarConfirmacao email={conta.email} />
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
