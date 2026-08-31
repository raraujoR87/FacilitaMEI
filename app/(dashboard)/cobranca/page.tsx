import Link from "next/link";
import { CircleCheck, Clock } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { cancelarDocumento, marcarComoPago } from "@/app/actions/vendas";
import { estaVencido, formatarData, formatarMoeda } from "@/lib/formato";
import { formatarMomento } from "@/lib/admin";
import { gerarBrCode, perfilTemPix, type TipoChavePix } from "@/lib/pix";
import { linkWhatsApp } from "@/lib/whatsapp";
import { Carimbo, Recibo, Vazio } from "@/components/ui/campos";
import { BotaoQueRemove, LinhaAcao } from "@/components/ui/linha-acao";
import { BotaoCopiar } from "@/components/ui/botao-copiar";
import { ConverterOrcamento } from "./converter";

type Documento = {
  id: string;
  numero: number;
  tipo: "recibo" | "orcamento";
  descricao_servico: string;
  valor: number;
  data_vencimento: string | null;
  aceito_em: string | null;
  aceito_por: string | null;
  clientes:
    | { nome: string; telefone: string | null }
    | { nome: string; telefone: string | null }[]
    | null;
};

function primeiroCliente(clientes: Documento["clientes"]) {
  return Array.isArray(clientes) ? clientes[0] : clientes;
}

export default async function CobrancaPage() {
  const { supabase, user } = await exigirUsuario();

  const [{ data: pendentes }, { data: perfil }] = await Promise.all([
    supabase
      .from("documentos_venda")
      .select(
        "id, numero, tipo, descricao_servico, valor, data_vencimento, aceito_em, aceito_por, clientes(nome, telefone)"
      )
      .eq("user_id", user.id)
      .eq("status", "pendente")
      .order("data_vencimento", { ascending: true, nullsFirst: false }),
    supabase
      .from("perfis")
      .select("nome_negocio, chave_pix, tipo_chave_pix, nome_titular_pix, cidade_pix")
      .eq("id", user.id)
      .single(),
  ]);

  const todos = (pendentes ?? []) as Documento[];

  // Orçamento não é dinheiro a receber: é proposta. Misturar os dois inflava
  // o total com valor que ninguém se comprometeu a pagar.
  const cobrancas = todos.filter((d) => d.tipo === "recibo");
  const orcamentos = todos.filter((d) => d.tipo === "orcamento");
  const aceitos = orcamentos.filter((o) => o.aceito_em !== null);
  const aguardando = orcamentos.filter((o) => o.aceito_em === null);

  const total = cobrancas.reduce((soma, p) => soma + Number(p.valor), 0);
  const vencidos = cobrancas.filter((p) => estaVencido(p.data_vencimento));
  const pixConfigurado = perfil ? perfilTemPix(perfil) : false;

  return (
    <div>
      <h1 className="text-2xl mb-2" style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}>
        A receber
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--tinta-suave)" }}>
        {cobrancas.length === 0
          ? "Nenhuma cobrança pendente."
          : `${formatarMoeda(total)} a receber` +
            (vencidos.length > 0 ? ` · ${vencidos.length} vencida(s)` : "")}
      </p>

      {/* Aceite chega pelo link, sem passar por aqui: se não aparecer em
          destaque, o MEI só descobre por acaso — e perde a venda pelo
          tempo de resposta. */}
      {aceitos.length > 0 && (
        <section className="mb-6">
          <h2
            className="text-sm font-semibold mb-2 flex items-center gap-1.5"
            style={{ color: "var(--positivo)" }}
          >
            <CircleCheck size={16} aria-hidden />
            {aceitos.length === 1
              ? "1 orçamento aceito pelo cliente"
              : `${aceitos.length} orçamentos aceitos pelo cliente`}
          </h2>

          <div
            className="rounded-lg border-2 divide-y"
            style={{ borderColor: "var(--positivo)", background: "#fff" }}
          >
            {aceitos.map((o) => {
              const cliente = primeiroCliente(o.clientes);
              return (
                <div key={o.id} className="px-5 py-4">
                  <div className="flex flex-wrap justify-between items-start gap-3">
                    <div className="min-w-0">
                      <Link href={`/recibo/${o.id}`} className="font-medium underline block truncate">
                        #{o.numero} · {o.descricao_servico}
                      </Link>
                      <p className="text-xs" style={{ color: "var(--positivo)" }}>
                        Aceito por {o.aceito_por} em {formatarMomento(o.aceito_em)}
                      </p>
                      {cliente?.nome && (
                        <p className="text-xs" style={{ color: "var(--tinta-suave)" }}>
                          {cliente.nome}
                        </p>
                      )}
                    </div>
                    <span className="valor shrink-0">{formatarMoeda(Number(o.valor))}</span>
                  </div>

                  <div className="mt-3">
                    <ConverterOrcamento id={o.id} numero={o.numero} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {aguardando.length > 0 && (
        <section className="mb-6">
          <h2
            className="text-sm font-semibold mb-2 flex items-center gap-1.5"
            style={{ color: "var(--tinta-suave)" }}
          >
            <Clock size={15} aria-hidden />
            {aguardando.length === 1
              ? "1 orçamento aguardando resposta"
              : `${aguardando.length} orçamentos aguardando resposta`}
          </h2>

          <div
            className="rounded-lg border divide-y"
            style={{ borderColor: "var(--borda)", background: "#fff" }}
          >
            {aguardando.map((o) => (
              <LinhaAcao
                key={o.id}
                className="px-5 py-3 flex flex-wrap justify-between items-center gap-3 text-sm"
              >
                <Link href={`/recibo/${o.id}`} className="underline truncate">
                  #{o.numero} · {o.descricao_servico}
                </Link>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="valor">{formatarMoeda(Number(o.valor))}</span>
                  <BotaoQueRemove acao={cancelarDocumento} id={o.id} variante="discreto">
                    Cancelar
                  </BotaoQueRemove>
                </div>
              </LinhaAcao>
            ))}
          </div>
        </section>
      )}

      {!pixConfigurado && cobrancas.length > 0 && (
        <p className="aviso aviso-erro mb-6">
          Cadastre sua chave PIX em{" "}
          <Link href="/configuracoes" className="underline font-medium">
            Configurações
          </Link>{" "}
          para gerar o código de pagamento junto com a cobrança.
        </p>
      )}

      <Recibo titulo="Cobranças">
        {cobrancas.length === 0 ? (
          <Vazio>
            Nenhuma cobrança pendente. Recibos emitidos sem marcar &quot;já
            recebi&quot; aparecem aqui.
          </Vazio>
        ) : (
          <div className="flex flex-col divide-y" style={{ borderColor: "var(--borda)" }}>
            {cobrancas.map((p) => {
              const cliente = primeiroCliente(p.clientes);
              const vencido = estaVencido(p.data_vencimento);

              const brcode =
                pixConfigurado && perfil
                  ? gerarBrCode({
                      chave: perfil.chave_pix!,
                      tipoChave: perfil.tipo_chave_pix as TipoChavePix,
                      nomeTitular: perfil.nome_titular_pix!,
                      cidade: perfil.cidade_pix ?? "",
                      valor: Number(p.valor),
                      identificador: `AMEI${p.numero}`,
                    })
                  : null;

              const mensagem =
                `Olá${cliente?.nome ? ` ${cliente.nome}` : ""}! ` +
                `Segue a cobrança de ${p.descricao_servico}: ${formatarMoeda(Number(p.valor))}.` +
                (brcode ? `\n\nPIX copia e cola:\n${brcode}` : "");

              const whatsapp = linkWhatsApp(cliente?.telefone ?? null, mensagem);

              return (
                <LinhaAcao key={p.id} className="py-4 text-sm">
                  <div className="flex justify-between items-start gap-4">
                    <div className="min-w-0">
                      <Link
                        href={`/recibo/${p.id}`}
                        className="font-medium truncate block underline"
                      >
                        #{p.numero} · {p.descricao_servico}
                      </Link>
                      <p className="text-xs" style={{ color: "var(--tinta-suave)" }}>
                        {cliente?.nome ?? "Sem cliente"}
                        {p.data_vencimento
                          ? ` · ${vencido ? "venceu" : "vence"} ${formatarData(p.data_vencimento)}`
                          : " · sem prazo"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className="valor"
                        style={{ color: vencido ? "var(--selo)" : "var(--pendente)" }}
                      >
                        {formatarMoeda(Number(p.valor))}
                      </span>
                      {vencido && <Carimbo status="vencido" />}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <BotaoQueRemove
                      acao={marcarComoPago}
                      id={p.id}
                      carregando="Baixando..."
                    >
                      Recebi
                    </BotaoQueRemove>

                    {whatsapp && (
                      <a
                        href={whatsapp}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="botao botao-secundario"
                      >
                        Cobrar no WhatsApp
                      </a>
                    )}

                    <BotaoQueRemove acao={cancelarDocumento} id={p.id} variante="discreto">
                      Cancelar
                    </BotaoQueRemove>
                  </div>

                  {brcode && (
                    <details className="mt-3">
                      <summary className="text-xs cursor-pointer" style={{ color: "var(--tinta-suave)" }}>
                        Ver código PIX
                      </summary>
                      <div className="mt-2 flex flex-col gap-2">
                        <code className="brcode">{brcode}</code>
                        <BotaoCopiar texto={brcode} />
                      </div>
                    </details>
                  )}
                </LinhaAcao>
              );
            })}
          </div>
        )}
      </Recibo>
    </div>
  );
}
