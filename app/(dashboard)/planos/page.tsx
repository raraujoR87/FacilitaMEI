import { Check, Sparkles } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { formatarMoeda, intervaloDoMes, mesAtual, rotuloMes } from "@/lib/formato";
import {
  contatoWhatsApp,
  economiaAnual,
  diasDeTesteRestantes,
  estaEmTeste,
  limiteDeNotas,
  linkAssinatura,
  planoEfetivo,
  PLANOS,
} from "@/lib/planos";
import { Recibo } from "@/components/ui/campos";

export default async function PlanosPage() {
  const { supabase, user } = await exigirUsuario();
  const mes = mesAtual();
  const { inicio } = intervaloDoMes(mes);

  const [{ data: perfil }, { count }] = await Promise.all([
    supabase
      .from("perfis")
      .select("plano, plano_expira_em, trial_expira_em, limite_notas_mes")
      .eq("id", user.id)
      .single(),
    supabase
      .from("lancamentos")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .in("origem", ["ocr", "upload", "whatsapp"])
      .gte("created_at", `${inicio}T00:00:00Z`),
  ]);

  const planoAtual = planoEfetivo(perfil);
  const limite = limiteDeNotas(perfil);
  // Assinatura vencida: a conta já voltou a se comportar como grátis, e
  // esconder isso faria o cliente achar que perdeu recurso sem motivo.
  const venceu =
    perfil?.plano === "pro" && planoAtual === "free" ? perfil.plano_expira_em : null;
  const usadas = count ?? 0;
  const proporcao = limite > 0 ? Math.min(100, Math.round((usadas / limite) * 100)) : 0;

  const mensal = linkAssinatura("mensal");
  const anual = linkAssinatura("anual");
  const whatsapp = contatoWhatsApp();

  return (
    <div>
      <h1 className="text-2xl mb-1" style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}>
        Plano e cobrança
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--tinta-suave)" }}>
        Você está no plano{" "}
        <strong style={{ color: "var(--tinta)" }}>{PLANOS[planoAtual].nome}</strong>.
      </p>

      {estaEmTeste(perfil) && (
        <div className="aviso mb-6" style={{ borderColor: "var(--positivo)", background: "rgba(47,110,91,0.08)" }}>
          <p>
            <strong>
              Você está testando o Pro — faltam {diasDeTesteRestantes(perfil)} dias.
            </strong>{" "}
            Depois disso a conta continua funcionando no plano grátis, sem
            perder nada do que você já registrou. O que muda são os recursos
            listados abaixo.
          </p>
        </div>
      )}

      {venceu && (
        <p className="aviso aviso-erro mb-6">
          Sua assinatura Pro venceu em {new Date(venceu).toLocaleDateString("pt-BR")}.
          A conta voltou ao plano grátis, e nada foi apagado.
        </p>
      )}

      {planoAtual === "free" && (
        <Recibo className="mb-6">
          <div className="flex items-baseline justify-between gap-4 mb-2">
            <p className="text-sm font-medium">Notas lidas por foto</p>
            <p className="valor text-sm">
              {usadas} de {limite} · {rotuloMes(mes)}
            </p>
          </div>

          <div
            className="h-2 rounded-full overflow-hidden"
            style={{ background: "var(--papel-escuro)" }}
            role="progressbar"
            aria-valuenow={usadas}
            aria-valuemin={0}
            aria-valuemax={limite}
            aria-label="Notas lidas por foto neste mês"
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${proporcao}%`,
                background: usadas >= limite ? "var(--selo)" : "var(--positivo)",
              }}
            />
          </div>

          <p className="dica mt-2">
            {usadas >= limite
              ? "Você usou todas as notas do mês. O lançamento manual continua liberado, e a leitura por foto volta no dia 1º."
              : "Lançamentos manuais nunca contam para esse limite."}
          </p>
        </Recibo>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {(["free", "pro"] as const).map((id) => {
          const plano = PLANOS[id];
          const atual = planoAtual === id;

          return (
            <section
              key={id}
              className="rounded-lg border px-6 py-6 flex flex-col"
              style={{
                borderColor: id === "pro" ? "var(--positivo)" : "var(--borda)",
                borderWidth: id === "pro" ? 2 : 1,
                background: "#fff",
              }}
            >
              <div className="flex items-center gap-2">
                {id === "pro" && (
                  <Sparkles size={16} style={{ color: "var(--positivo)" }} aria-hidden />
                )}
                <h2
                  className="text-lg"
                  style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}
                >
                  {plano.nome}
                </h2>
                {atual && <span className="carimbo">atual</span>}
              </div>

              <p className="dica">{plano.chamada}</p>

              <p className="mt-4">
                <span className="valor text-2xl">
                  {plano.precoMensal === 0 ? "R$ 0" : formatarMoeda(plano.precoMensal)}
                </span>
                <span className="text-sm" style={{ color: "var(--tinta-suave)" }}>
                  {plano.precoMensal === 0 ? " para sempre" : " / mês"}
                </span>
              </p>

              {id === "pro" && (
                <p className="dica">
                  Ou {formatarMoeda(plano.precoAnual)}/mês no plano anual —{" "}
                  economiza {formatarMoeda(economiaAnual())} por ano.
                </p>
              )}

              <ul className="mt-4 flex flex-col gap-1.5 text-sm flex-1">
                {plano.destaques.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check
                      size={15}
                      strokeWidth={3}
                      className="mt-0.5 shrink-0"
                      style={{ color: "var(--positivo)" }}
                      aria-hidden
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              {id === "pro" && !atual && (
                <div className="mt-5 flex flex-col gap-2">
                  {mensal || anual ? (
                    <>
                      {mensal && (
                        <a href={mensal} className="botao" target="_blank" rel="noopener noreferrer">
                          Assinar por {formatarMoeda(plano.precoMensal)}/mês
                        </a>
                      )}
                      {anual && (
                        <a
                          href={anual}
                          className="botao botao-secundario"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Assinar o anual e economizar
                        </a>
                      )}
                    </>
                  ) : whatsapp ? (
                    <a
                      href={`${whatsapp}?text=${encodeURIComponent("Quero assinar o plano Pro do AgilizeMei.")}`}
                      className="botao"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Falar com a gente para assinar
                    </a>
                  ) : (
                    <p className="aviso aviso-erro">
                      Assinatura ainda não configurada. Defina
                      <code> NEXT_PUBLIC_LINK_ASSINATURA_MENSAL </code>
                      ou <code> NEXT_PUBLIC_WHATSAPP_CONTATO</code>.
                    </p>
                  )}
                </div>
              )}

              {id === "free" && planoAtual === "pro" && (
                <p className="dica mt-5">
                  Para voltar ao grátis, cancele a assinatura no gateway de
                  pagamento e fale com a gente.
                </p>
              )}
            </section>
          );
        })}
      </div>

      <p className="dica mt-6">
        Sem fidelidade e sem multa: cancelando, você continua no plano grátis com
        seus dados intactos. Nada é apagado.
      </p>
    </div>
  );
}
