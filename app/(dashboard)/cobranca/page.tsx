import Link from "next/link";
import { exigirUsuario } from "@/lib/auth";
import { cancelarDocumento, marcarComoPago } from "@/app/actions/vendas";
import { estaVencido, formatarData, formatarMoeda } from "@/lib/formato";
import { gerarBrCode, perfilTemPix, type TipoChavePix } from "@/lib/pix";
import { linkWhatsApp } from "@/lib/whatsapp";
import { Carimbo, Recibo, Vazio } from "@/components/ui/campos";
import { BotaoSubmit } from "@/components/ui/botao-submit";
import { BotaoCopiar } from "@/components/ui/botao-copiar";

type Pendente = {
  id: string;
  numero: number;
  descricao_servico: string;
  valor: number;
  data_vencimento: string | null;
  clientes: { nome: string; telefone: string | null } | { nome: string; telefone: string | null }[] | null;
};

function primeiroCliente(clientes: Pendente["clientes"]) {
  return Array.isArray(clientes) ? clientes[0] : clientes;
}

export default async function CobrancaPage() {
  const { supabase, user } = await exigirUsuario();

  const [{ data: pendentes }, { data: perfil }] = await Promise.all([
    supabase
      .from("documentos_venda")
      .select(
        "id, numero, descricao_servico, valor, data_vencimento, clientes(nome, telefone)"
      )
      .eq("user_id", user.id)
      .eq("status", "pendente")
      // Nulos por último: o que tem prazo definido é o que cobra primeiro.
      .order("data_vencimento", { ascending: true, nullsFirst: false }),
    supabase
      .from("perfis")
      .select("nome_negocio, chave_pix, tipo_chave_pix, nome_titular_pix, cidade_pix")
      .eq("id", user.id)
      .single(),
  ]);

  const lista = (pendentes ?? []) as Pendente[];
  const total = lista.reduce((soma, p) => soma + Number(p.valor), 0);
  const vencidos = lista.filter((p) => estaVencido(p.data_vencimento));
  const pixConfigurado = perfil ? perfilTemPix(perfil) : false;

  return (
    <div>
      <h1 className="text-2xl mb-2" style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}>
        Cobrança
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--tinta-suave)" }}>
        {lista.length === 0
          ? "Tudo em dia."
          : `${formatarMoeda(total)} a receber` +
            (vencidos.length > 0 ? ` · ${vencidos.length} vencida(s)` : "")}
      </p>

      {!pixConfigurado && lista.length > 0 && (
        <p className="aviso aviso-erro mb-6">
          Cadastre sua chave PIX em{" "}
          <Link href="/configuracoes" className="underline font-medium">
            Configurações
          </Link>{" "}
          para gerar o código de pagamento junto com a cobrança.
        </p>
      )}

      <Recibo titulo="A receber">
        {lista.length === 0 ? (
          <Vazio>
            Nenhuma cobrança pendente. Recibos emitidos em Vendas com data de
            vencimento aparecem aqui.
          </Vazio>
        ) : (
          <div className="flex flex-col divide-y" style={{ borderColor: "var(--borda)" }}>
            {lista.map((p) => {
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
                      identificador: `FMEI${p.numero}`,
                    })
                  : null;

              const mensagem =
                `Olá${cliente?.nome ? ` ${cliente.nome}` : ""}! ` +
                `Segue a cobrança de ${p.descricao_servico}: ${formatarMoeda(Number(p.valor))}.` +
                (brcode ? `\n\nPIX copia e cola:\n${brcode}` : "");

              const whatsapp = linkWhatsApp(cliente?.telefone ?? null, mensagem);

              return (
                <div key={p.id} className="py-4 text-sm">
                  <div className="flex justify-between items-start gap-4">
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        #{p.numero} · {p.descricao_servico}
                      </p>
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
                    <form action={marcarComoPago}>
                      <input type="hidden" name="id" value={p.id} />
                      <BotaoSubmit carregando="Baixando...">Recebi</BotaoSubmit>
                    </form>

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

                    <form action={cancelarDocumento}>
                      <input type="hidden" name="id" value={p.id} />
                      <BotaoSubmit variante="discreto" carregando="...">
                        Cancelar
                      </BotaoSubmit>
                    </form>
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
                </div>
              );
            })}
          </div>
        )}
      </Recibo>
    </div>
  );
}
