import { AlertTriangle, TrendingUp } from "lucide-react";
import { formatarMoeda } from "@/lib/formato";
import { corDaFaixa, type SituacaoTeto } from "@/lib/mei";

/**
 * O teto do MEI em cima da tela.
 *
 * É a informação que o cliente não consegue em lugar nenhum: só quem tem o
 * faturamento do ano inteiro sabe dizer quanto falta. Estourar o teto sem
 * perceber custa desenquadramento retroativo, e é o medo que faz o MEI
 * procurar contador em dezembro correndo.
 */
export function PainelTeto({
  situacao,
  ano,
  proporcional,
}: {
  situacao: SituacaoTeto;
  ano: number;
  proporcional: boolean;
}) {
  const cor = corDaFaixa(situacao.faixa);
  const alerta = situacao.faixa !== "tranquilo" && situacao.faixa !== "atencao";
  const largura = Math.min(100, situacao.percentual);

  return (
    <section
      className="rounded-lg border px-5 py-5 mb-6"
      style={{
        borderColor: alerta ? cor : "var(--borda)",
        borderWidth: alerta ? 2 : 1,
        background: "#fff",
      }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <p className="text-sm font-medium flex items-center gap-1.5">
          {alerta ? (
            <AlertTriangle size={15} style={{ color: cor }} aria-hidden />
          ) : (
            <TrendingUp size={15} style={{ color: cor }} aria-hidden />
          )}
          Teto do MEI em {ano}
        </p>
        <p className="text-sm">
          <span className="valor" style={{ color: cor }}>
            {formatarMoeda(situacao.faturado)}
          </span>
          <span style={{ color: "var(--tinta-suave)" }}>
            {" "}
            de {formatarMoeda(situacao.teto)}
          </span>
        </p>
      </div>

      <div
        className="h-2.5 rounded-full overflow-hidden mb-2"
        style={{ background: "var(--papel-escuro)" }}
        role="progressbar"
        aria-valuenow={Math.round(situacao.faturado)}
        aria-valuemin={0}
        aria-valuemax={Math.round(situacao.teto)}
        aria-label={`Faturamento do ano em relação ao teto do MEI de ${ano}`}
      >
        <div className="h-full rounded-full" style={{ width: `${largura}%`, background: cor }} />
      </div>

      <p className="text-sm">
        <strong style={{ color: cor }}>{situacao.resumo}.</strong>{" "}
        <span style={{ color: "var(--tinta-suave)" }}>
          {situacao.restante > 0
            ? `Ainda dá para faturar ${formatarMoeda(situacao.restante)} como MEI neste ano.`
            : situacao.detalhe}
        </span>
      </p>

      {situacao.restante > 0 && situacao.faixa !== "tranquilo" && (
        <p className="dica mt-1">{situacao.detalhe}</p>
      )}

      {proporcional && (
        <p className="dica mt-2">
          Seu teto é proporcional porque o CNPJ abriu durante {ano}: conta-se
          R$ 6.750 por mês, do mês de abertura até dezembro.
        </p>
      )}

      {situacao.faixa === "estourado" && (
        <p className="dica mt-2">
          Passando de {formatarMoeda(situacao.limiteRetroativo)} no ano, o
          desenquadramento deixa de ser só do ano seguinte e vira retroativo a
          janeiro.
        </p>
      )}
    </section>
  );
}
