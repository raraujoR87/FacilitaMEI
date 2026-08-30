import {
  exigirAdministrador,
  formatarMomento,
  formatarTamanho,
  tempoDesde,
  type Tenant,
} from "@/lib/admin";
import { formatarData, formatarDataDoMomento, formatarMoeda } from "@/lib/formato";
import { situacaoTeto } from "@/lib/mei";
import { diasDeTesteRestantes, estaEmTeste } from "@/lib/planos";
import { Carimbo, Recibo, Vazio } from "@/components/ui/campos";
import { AcoesTenant } from "./acoes-tenant";

export default async function AdminTenantsPage() {
  const { supabase } = await exigirAdministrador();

  const { data, error } = await supabase.rpc("admin_lista_tenants");
  const tenants = (data ?? []) as Tenant[];

  const ativos = tenants.filter((t) => t.ultimo_lancamento !== null).length;
  const pagantes = tenants.filter((t) => t.plano_efetivo === "pro" && !estaEmTeste(t)).length;
  const emTeste = tenants.filter((t) => estaEmTeste(t)).length;
  const notasNoMes = tenants.reduce((s, t) => s + Number(t.notas_ia_no_mes), 0);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4 mb-2">
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800 }} className="text-2xl">
          Tenants
        </h1>
        <p className="text-sm" style={{ color: "var(--tinta-suave)" }}>
          {tenants.length} conta(s) · {ativos} com movimento · {pagantes}{" "}
          pagante(s) · {emTeste} em teste · {notasNoMes} nota(s) lida(s) por IA
          neste mês
        </p>
      </div>

      <p className="dica mb-6">
        Este painel mostra o estado das contas, nunca o conteúdo financeiro
        delas. Descrições, valores e comprovantes dos clientes não são
        legíveis aqui — a restrição está nas políticas do banco, não nesta
        tela.
      </p>

      {error && (
        <p className="aviso aviso-erro mb-6">
          Não foi possível carregar os tenants: {error.message}
        </p>
      )}

      {tenants.length === 0 ? (
        <Recibo>
          <Vazio>Nenhuma conta cadastrada ainda.</Vazio>
        </Recibo>
      ) : (
        <div className="flex flex-col gap-3">
          {tenants.map((t) => (
            <section
              key={t.user_id}
              className="rounded-lg border px-5 py-4"
              style={{ borderColor: "var(--borda)", background: "#fff" }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {t.nome_negocio}{" "}
                    <span className="font-normal" style={{ color: "var(--tinta-suave)" }}>
                      · {t.email ?? "sem e-mail"}
                    </span>
                  </p>
                  <p className="text-xs" style={{ color: "var(--tinta-suave)" }}>
                    Entrou em {formatarDataDoMomento(t.criado_em)} · último acesso{" "}
                    {tempoDesde(t.ultimo_acesso)}
                    {t.ultimo_lancamento
                      ? ` · último lançamento ${formatarData(t.ultimo_lancamento)}`
                      : " · nunca lançou nada"}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {t.bloqueado && <Carimbo status="bloqueado" />}
                  {!t.email_confirmado && <Carimbo status="pendente" />}
                  {/* O que vale é o plano efetivo. Mostrar só a coluna
                      `plano` escondia que o acesso vinha do teste, e uma
                      promoção parecia não ter surtido efeito. */}
                  <Carimbo status={t.plano_efetivo} />
                  {estaEmTeste(t) && (
                    <span className="text-xs" style={{ color: "var(--pendente)" }}>
                      teste · {diasDeTesteRestantes(t)}d
                    </span>
                  )}
                </div>
              </div>

              <dl className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2 text-sm">
                <Metrica rotulo="Lançamentos" valor={t.total_lancamentos} />
                <Metrica rotulo="Documentos" valor={t.total_documentos} />
                <Metrica rotulo="Clientes" valor={t.total_clientes} />
                <Metrica
                  rotulo="Notas IA/mês"
                  valor={`${t.notas_ia_no_mes}/${t.limite_notas_mes}`}
                  alerta={Number(t.notas_ia_no_mes) >= t.limite_notas_mes}
                />
                <Metrica
                  rotulo="Comprovantes"
                  valor={`${t.total_comprovantes} · ${formatarTamanho(Number(t.bytes_comprovantes))}`}
                />
                <Metrica
                  rotulo="Teto do MEI"
                  valor={`${situacaoTeto(Number(t.faturamento_ano), new Date().getUTCFullYear()).percentual}%`}
                  alerta={
                    situacaoTeto(Number(t.faturamento_ano), new Date().getUTCFullYear()).faixa !==
                    "tranquilo"
                  }
                />
                <Metrica
                  rotulo="Faturou no ano"
                  valor={formatarMoeda(Number(t.faturamento_ano))}
                />
                <Metrica
                  rotulo="Configurou"
                  valor={
                    [t.tem_pix && "PIX", t.tem_whatsapp && "WhatsApp"]
                      .filter(Boolean)
                      .join(" + ") || "nada"
                  }
                />
              </dl>

              <details className="mt-2">
                <summary className="text-xs cursor-pointer" style={{ color: "var(--tinta-suave)" }}>
                  Administrar conta
                </summary>
                <AcoesTenant tenant={t} />
                <p className="dica mt-2">
                  Criada em {formatarMomento(t.criado_em)}
                  {t.trial_expira_em &&
                    ` · teste até ${formatarMomento(t.trial_expira_em)}`}
                  {t.plano_expira_em
                    ? ` · Pro até ${formatarMomento(t.plano_expira_em)}`
                    : t.plano === "pro"
                    ? " · Pro sem prazo"
                    : ""}
                </p>
                <p className="dica">id {t.user_id}</p>
              </details>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Metrica({
  rotulo,
  valor,
  alerta,
}: {
  rotulo: string;
  valor: string | number;
  alerta?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs" style={{ color: "var(--tinta-suave)" }}>
        {rotulo}
      </dt>
      <dd
        className="valor"
        style={{ color: alerta ? "var(--selo)" : "var(--tinta)" }}
      >
        {valor}
      </dd>
    </div>
  );
}
