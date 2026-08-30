import Link from "next/link";
import { AlertTriangle, PhoneOff, Trophy } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { excluirCliente } from "@/app/actions/clientes";
import { formatarData, formatarMoeda } from "@/lib/formato";
import { formatarDocumento, tipoPessoa } from "@/lib/fiscal";
import { linkWhatsApp } from "@/lib/whatsapp";
import {
  descreverRecorrencia,
  rankingTemInversao,
  ROTULO_SITUACAO,
  situacaoDoCliente,
  type MetricaCliente,
} from "@/lib/clientes";
import { Recibo, Vazio } from "@/components/ui/campos";
import { BotaoSubmit } from "@/components/ui/botao-submit";
import { FormularioCliente } from "./formulario";

export default async function ClientesPage() {
  const { supabase } = await exigirUsuario();

  // Uma chamada só: calcular por cliente na aplicação seria N+1, e a
  // carteira de um MEI cabe inteira numa passada no banco.
  const { data } = await supabase.rpc("metricas_clientes");
  const clientes = (data ?? []) as MetricaCliente[];

  const comSituacao = clientes.map((c) => ({ m: c, situacao: situacaoDoCliente(c) }));
  const devendo = comSituacao.filter((c) => c.situacao === "devendo");
  const sumidos = comSituacao.filter((c) => c.situacao === "sumido");

  const faturadoTotal = clientes.reduce((s, c) => s + Number(c.total_pago), 0);
  const emAberto = clientes.reduce((s, c) => s + Number(c.total_aberto), 0);
  const compradores = clientes.filter((c) => c.documentos > 0);
  const ticketGeral =
    compradores.length > 0
      ? faturadoTotal / compradores.reduce((s, c) => s + Number(c.documentos), 0)
      : 0;

  const maiores = clientes.filter((c) => Number(c.total_pago) > 0).slice(0, 5);
  const maiorValor = maiores.length > 0 ? Number(maiores[0].total_pago) : 0;

  const custoTotal = clientes.reduce((s, c) => s + Number(c.custo_atribuido), 0);
  const lucroTotal = faturadoTotal - custoTotal;
  const temCusto = custoTotal > 0;
  const inversao = rankingTemInversao(clientes);
  const campeaoDoLucro = temCusto
    ? [...clientes].sort((a, b) => Number(b.lucro) - Number(a.lucro))[0]
    : null;

  return (
    <div>
      <h1 className="text-2xl mb-1" style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}>
        Clientes
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--tinta-suave)" }}>
        {clientes.length} cadastrado(s) · {compradores.length} já compraram
      </p>

      {clientes.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Cartao rotulo="Já faturado" valor={formatarMoeda(faturadoTotal)} cor="var(--positivo)" />
          <Cartao rotulo="A receber" valor={formatarMoeda(emAberto)} cor="var(--pendente)" />
          <Cartao
            rotulo={temCusto ? "Sobrou (lucro)" : "Ticket médio"}
            valor={formatarMoeda(temCusto ? lucroTotal : ticketGeral)}
            cor={temCusto && lucroTotal < 0 ? "var(--selo)" : undefined}
          />
          <Cartao
            rotulo="Precisam de atenção"
            valor={String(devendo.length + sumidos.length)}
            cor={devendo.length + sumidos.length > 0 ? "var(--selo)" : undefined}
          />
        </div>
      )}

      {/* Ação antes de relatório: o MEI não precisa de número, precisa
          saber a quem ligar hoje. */}
      {devendo.length > 0 && (
        <ListaDeAtencao
          titulo={`${devendo.length} cliente(s) com pagamento vencido`}
          Icone={AlertTriangle}
          cor="var(--selo)"
          itens={devendo}
          mensagem={(m) =>
            `Olá ${m.nome}! Passando para lembrar do pagamento de ${formatarMoeda(Number(m.total_vencido))} que está em aberto.`
          }
          detalhe={(m) => `${formatarMoeda(Number(m.total_vencido))} vencidos`}
        />
      )}

      {sumidos.length > 0 && (
        <ListaDeAtencao
          titulo={`${sumidos.length} cliente(s) habituais sumiram`}
          Icone={PhoneOff}
          cor="var(--pendente)"
          itens={sumidos}
          mensagem={(m) => `Olá ${m.nome}! Faz um tempo que a gente não se fala. Precisa de alguma coisa?`}
          detalhe={(m) =>
            `sem comprar há ${m.dias_desde_ultima} dias · ${descreverRecorrencia(m)}`
          }
        />
      )}

      {maiores.length > 0 && (
        <Recibo className="mb-6">
          <p className="text-xs uppercase tracking-widest mb-3 flex items-center gap-1.5" style={{ color: "var(--tinta-suave)" }}>
            <Trophy size={13} aria-hidden />
            Maiores clientes
          </p>
          <div className="flex flex-col gap-2.5">
            {maiores.map((c) => (
              <div key={c.cliente_id}>
                <div className="flex justify-between text-sm mb-1 gap-3">
                  <span className="truncate">{c.nome}</span>
                  <span className="valor shrink-0">{formatarMoeda(Number(c.total_pago))}</span>
                </div>
                <div className="h-1.5 rounded-full" style={{ background: "var(--papel-escuro)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${maiorValor > 0 ? (Number(c.total_pago) / maiorValor) * 100 : 0}%`,
                      background: "var(--positivo)",
                    }}
                  />
                </div>
                <p className="dica">
                  {c.documentos} compra{c.documentos > 1 ? "s" : ""} ·{" "}
                  {descreverRecorrencia(c)} · ticket {formatarMoeda(Number(c.ticket_medio))}
                  {Number(c.custo_atribuido) > 0 && (
                    <>
                      {" "}
                      · sobrou{" "}
                      <strong
                        style={{
                          color: Number(c.lucro) < 0 ? "var(--selo)" : "var(--positivo)",
                        }}
                      >
                        {formatarMoeda(Number(c.lucro))}
                      </strong>
                    </>
                  )}
                </p>
              </div>
            ))}
          </div>

          {inversao && campeaoDoLucro ? (
            <p className="dica mt-3 pt-3 border-t" style={{ borderColor: "var(--borda)" }}>
              Quem mais fatura não é quem mais dá lucro: depois dos custos,{" "}
              <strong>{campeaoDoLucro.nome}</strong> deixa{" "}
              {formatarMoeda(Number(campeaoDoLucro.lucro))} — mais que{" "}
              {maiores[0].nome}.
            </p>
          ) : (
            !temCusto && (
              <p className="dica mt-3 pt-3 border-t" style={{ borderColor: "var(--borda)" }}>
                Este ranking é de faturamento. Vincule suas saídas aos trabalhos
                em Movimento para ver quem realmente dá mais lucro.
              </p>
            )
          )}
        </Recibo>
      )}

      <FormularioCliente />

      <Recibo titulo="Todos os clientes">
        {clientes.length === 0 ? (
          <Vazio>
            Nenhum cliente cadastrado. Cadastrar aqui permite vincular recibos,
            saber quem mais compra e quem está devendo.
          </Vazio>
        ) : (
          <div className="flex flex-col divide-y" style={{ borderColor: "var(--borda)" }}>
            {comSituacao.map(({ m, situacao }) => {
              const rotulo = ROTULO_SITUACAO[situacao];
              return (
                <div key={m.cliente_id} className="flex justify-between items-start gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {m.nome}{" "}
                      <span className="text-xs font-normal" style={{ color: rotulo.cor }}>
                        · {rotulo.texto}
                      </span>
                    </p>
                    <p className="text-xs" style={{ color: "var(--tinta-suave)" }}>
                      {m.documento
                        ? `${formatarDocumento(m.documento)} · ${tipoPessoa(m.documento) === "juridica" ? "empresa" : "pessoa física"}`
                        : "sem CPF/CNPJ"}
                      {m.ultima_compra && ` · última em ${formatarData(m.ultima_compra)}`}
                      {m.pagou_com_atraso > 0 &&
                        ` · atrasou ${m.pagou_com_atraso}x`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 text-right">
                    <div>
                      {Number(m.total_pago) > 0 && (
                        <p className="valor" style={{ color: "var(--positivo)" }}>
                          {formatarMoeda(Number(m.total_pago))}
                        </p>
                      )}
                      {Number(m.total_aberto) > 0 && (
                        <p className="valor text-xs" style={{ color: "var(--pendente)" }}>
                          {formatarMoeda(Number(m.total_aberto))} em aberto
                        </p>
                      )}
                    </div>
                    {/* Excluir só quem nunca comprou: apagar cliente com
                        histórico deixaria recibos órfãos de nome. */}
                    {m.documentos === 0 && (
                      <form action={excluirCliente}>
                        <input type="hidden" name="id" value={m.cliente_id} />
                        <BotaoSubmit variante="discreto" carregando="...">
                          Excluir
                        </BotaoSubmit>
                      </form>
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

function Cartao({ rotulo, valor, cor }: { rotulo: string; valor: string; cor?: string }) {
  return (
    <div className="rounded-lg border px-3 py-3" style={{ borderColor: "var(--borda)" }}>
      <p className="text-xs" style={{ color: "var(--tinta-suave)" }}>
        {rotulo}
      </p>
      <p className="valor mt-0.5" style={{ color: cor ?? "var(--tinta)" }}>
        {valor}
      </p>
    </div>
  );
}

function ListaDeAtencao({
  titulo,
  Icone,
  cor,
  itens,
  mensagem,
  detalhe,
}: {
  titulo: string;
  Icone: React.ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
  cor: string;
  itens: { m: MetricaCliente }[];
  mensagem: (m: MetricaCliente) => string;
  detalhe: (m: MetricaCliente) => string;
}) {
  return (
    <section className="mb-6">
      <h2 className="text-sm font-semibold mb-2 flex items-center gap-1.5" style={{ color: cor }}>
        <Icone size={15} aria-hidden />
        {titulo}
      </h2>
      <div className="rounded-lg border divide-y" style={{ borderColor: cor, background: "#fff" }}>
        {itens.map(({ m }) => {
          const whatsapp = linkWhatsApp(m.telefone, mensagem(m));
          return (
            <div key={m.cliente_id} className="px-5 py-3 flex flex-wrap justify-between items-center gap-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium truncate">{m.nome}</p>
                <p className="text-xs" style={{ color: "var(--tinta-suave)" }}>
                  {detalhe(m)}
                </p>
              </div>
              {whatsapp ? (
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="botao botao-secundario shrink-0"
                >
                  Falar no WhatsApp
                </a>
              ) : (
                <Link href="/clientes" className="dica shrink-0">
                  sem telefone cadastrado
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
