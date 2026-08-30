import Link from "next/link";
import {
  ArrowRight,
  Camera,
  Check,
  FileText,
  HandCoins,
  Lock,
  Receipt,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { Marca } from "@/components/ui/marca";
import { formatarMoeda } from "@/lib/formato";
import { economiaAnual, PLANOS } from "@/lib/planos";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Cabecalho />
      <main className="flex-1">
        <Hero />
        <Dor />
        <ComoFunciona />
        <Modulos />
        <Precos />
        <Perguntas />
        <ChamadaFinal />
      </main>
      <Rodape />
    </div>
  );
}

function Cabecalho() {
  return (
    <header
      className="sticky top-0 z-40 border-b"
      style={{ borderColor: "var(--borda)", background: "rgba(247,245,240,0.9)", backdropFilter: "blur(8px)" }}
    >
      <div className="max-w-5xl mx-auto w-full px-5 py-3 flex items-center justify-between gap-4">
        <Marca />
        <div className="flex items-center gap-2">
          <Link href="/login" className="text-sm px-3 py-2">
            Entrar
          </Link>
          <Link href="/cadastro" className="botao text-sm">
            Começar grátis
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="max-w-5xl mx-auto w-full px-5 py-12 md:py-20 grid md:grid-cols-2 gap-10 md:gap-12 items-center">
      <div>
        <span className="carimbo" style={{ color: "var(--positivo)" }}>
          Feito pra quem trabalha sozinho
        </span>

        <h1
          className="mt-6 text-3xl sm:text-4xl md:text-5xl leading-[1.1]"
          style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}
        >
          Tira a foto da nota.
          <br />A gente organiza o resto.
        </h1>

        <p className="mt-5 text-base md:text-lg" style={{ color: "var(--tinta-suave)" }}>
          Financeiro, vendas e cobrança num só lugar — sem planilha, sem curso,
          sem contador te cobrando pra organizar papel. Você fotografa, o
          AgilizeMei categoriza e monta o relatório do mês.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <Link href="/cadastro" className="botao justify-center">
            Criar conta grátis
            <ArrowRight size={16} aria-hidden />
          </Link>
          <span
            className="self-center text-sm text-center sm:text-left"
            style={{ color: "var(--tinta-suave)" }}
          >
            Sem cartão de crédito
          </span>
        </div>

        <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm" style={{ color: "var(--tinta-suave)" }}>
          {["Leva 2 minutos pra começar", "Funciona no celular", "Cancele quando quiser"].map(
            (item) => (
              <li key={item} className="flex items-center gap-1.5">
                <Check size={14} strokeWidth={3} style={{ color: "var(--positivo)" }} aria-hidden />
                {item}
              </li>
            )
          )}
        </ul>
      </div>

      {/* Assinatura visual: a fita de recibo com o resumo do mês. */}
      <div className="fita-recibo mx-auto w-full max-w-sm px-6 py-8 md:rotate-1">
        <p className="text-xs uppercase tracking-widest text-center" style={{ color: "var(--tinta-suave)" }}>
          Resumo do mês
        </p>
        <div className="my-4 border-t border-dashed" style={{ borderColor: "var(--borda)" }} />

        {[
          { label: "Corte de cabelo", valor: "45,00", tipo: "receita" },
          { label: "Fornecedor — tintas", valor: "120,00", tipo: "despesa" },
          { label: "Manicure", valor: "35,00", tipo: "receita" },
          { label: "Escova progressiva", valor: "180,00", tipo: "receita" },
        ].map((item) => (
          <div key={item.label} className="flex justify-between py-1.5 text-sm gap-3">
            <span className="truncate">{item.label}</span>
            <span
              className="valor"
              style={{ color: item.tipo === "receita" ? "var(--positivo)" : "var(--selo)" }}
            >
              {item.tipo === "receita" ? "+" : "−"}R$ {item.valor}
            </span>
          </div>
        ))}

        <div className="my-4 border-t border-dashed" style={{ borderColor: "var(--borda)" }} />
        <div className="flex justify-between font-semibold">
          <span>Saldo</span>
          <span className="valor" style={{ color: "var(--positivo)" }}>
            +R$ 140,00
          </span>
        </div>

        <div className="mt-6 text-center">
          <span className="carimbo" style={{ color: "var(--positivo)" }}>
            pronto pro contador
          </span>
        </div>
      </div>
    </section>
  );
}

function Dor() {
  const itens = [
    {
      titulo: "A nota some antes de virar número",
      texto:
        "Cupom no bolso, boleto no e-mail, comprovante no WhatsApp. Na hora de fechar o mês, metade sumiu.",
    },
    {
      titulo: "Planilha é trabalho de outra pessoa",
      texto:
        "Você abriu o negócio pra atender cliente, não pra manter fórmula de Excel funcionando no domingo à noite.",
    },
    {
      titulo: "Cobrar dá vergonha e dá trabalho",
      texto:
        "Lembrar quem não pagou, achar a chave PIX, escrever a mensagem. Aí você deixa pra depois — e não recebe.",
    },
  ];

  return (
    <section style={{ background: "var(--papel-escuro)" }}>
      <div className="max-w-5xl mx-auto w-full px-5 py-14 md:py-20">
        <h2
          className="text-2xl md:text-3xl mb-8 max-w-2xl"
          style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}
        >
          Você não tem um problema de disciplina. Tem um problema de ferramenta.
        </h2>

        <div className="grid gap-5 md:grid-cols-3">
          {itens.map((item) => (
            <div key={item.titulo}>
              <h3 className="font-semibold mb-1.5">{item.titulo}</h3>
              <p className="text-sm" style={{ color: "var(--tinta-suave)" }}>
                {item.texto}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ComoFunciona() {
  const passos = [
    {
      Icone: Camera,
      titulo: "Fotografe a nota",
      texto:
        "Cupom, boleto ou recibo. A leitura por IA tira o valor, a data e o fornecedor sozinha.",
    },
    {
      Icone: Sparkles,
      titulo: "Confira em 5 segundos",
      texto:
        "O lançamento já vem categorizado. Você só olha se está certo — e corrige se não estiver.",
    },
    {
      Icone: FileText,
      titulo: "Feche o mês num clique",
      texto:
        "Relatório por categoria, pronto pra imprimir em PDF ou baixar em planilha e mandar pro contador.",
    },
  ];

  return (
    <section className="max-w-5xl mx-auto w-full px-5 py-14 md:py-20">
      <h2
        className="text-2xl md:text-3xl mb-2"
        style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}
      >
        Três passos, e acabou
      </h2>
      <p className="mb-10" style={{ color: "var(--tinta-suave)" }}>
        O trabalho todo cabe entre um cliente e outro.
      </p>

      <ol className="grid gap-6 md:grid-cols-3">
        {passos.map((passo, i) => (
          <li key={passo.titulo} className="flex md:block gap-4">
            <div
              className="shrink-0 w-11 h-11 rounded-lg flex items-center justify-center"
              style={{ background: "var(--tinta)", color: "var(--papel)" }}
            >
              <passo.Icone size={20} aria-hidden />
            </div>
            <div className="md:mt-4">
              <h3 className="font-semibold">
                <span style={{ color: "var(--tinta-suave)" }}>{i + 1}. </span>
                {passo.titulo}
              </h3>
              <p className="text-sm mt-1" style={{ color: "var(--tinta-suave)" }}>
                {passo.texto}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Modulos() {
  const modulos = [
    {
      Icone: TrendingUp,
      titulo: "Financeiro",
      texto: "Entradas e saídas do mês, com saldo e categoria. Manual ou por foto.",
    },
    {
      Icone: Receipt,
      titulo: "Vendas",
      texto: "Recibos e orçamentos numerados, com o nome do seu negócio.",
    },
    {
      Icone: HandCoins,
      titulo: "Cobrança",
      texto: "PIX copia e cola gerado na hora e cobrança pelo WhatsApp em um toque.",
    },
    {
      Icone: Users,
      titulo: "Clientes",
      texto: "Quem são, como falar com eles e quanto cada um já rendeu.",
    },
    {
      Icone: FileText,
      titulo: "Relatório",
      texto: "O mês fechado por categoria, em PDF ou planilha.",
    },
    {
      Icone: Lock,
      titulo: "Seus dados são seus",
      texto: "Cada conta é isolada no banco. Nem nossa equipe lê seus lançamentos.",
    },
  ];

  return (
    <section style={{ background: "var(--papel-escuro)" }}>
      <div className="max-w-5xl mx-auto w-full px-5 py-14 md:py-20">
        <h2
          className="text-2xl md:text-3xl mb-10"
          style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}
        >
          Tudo que o seu negócio precisa. Nada que ele não precisa.
        </h2>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {modulos.map((m) => (
            <div key={m.titulo}>
              <m.Icone size={20} style={{ color: "var(--positivo)" }} aria-hidden />
              <h3 className="font-semibold mt-2 mb-1">{m.titulo}</h3>
              <p className="text-sm" style={{ color: "var(--tinta-suave)" }}>
                {m.texto}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Precos() {
  return (
    <section id="precos" className="max-w-5xl mx-auto w-full px-5 py-14 md:py-20">
      <h2
        className="text-2xl md:text-3xl mb-2"
        style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}
      >
        Preço de MEI, não de empresa grande
      </h2>
      <p className="mb-10" style={{ color: "var(--tinta-suave)" }}>
        Comece de graça. Assine quando o volume justificar.
      </p>

      <div className="grid gap-5 md:grid-cols-2 max-w-3xl">
        {(["free", "pro"] as const).map((id) => {
          const plano = PLANOS[id];
          return (
            <div
              key={id}
              className="rounded-lg border px-6 py-7 flex flex-col"
              style={{
                borderColor: id === "pro" ? "var(--positivo)" : "var(--borda)",
                borderWidth: id === "pro" ? 2 : 1,
                background: "#fff",
              }}
            >
              <div className="flex items-center gap-2">
                <h3 className="text-lg" style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}>
                  {plano.nome}
                </h3>
                {id === "pro" && (
                  <span className="carimbo" style={{ color: "var(--positivo)" }}>
                    recomendado
                  </span>
                )}
              </div>
              <p className="dica">{plano.chamada}</p>

              <p className="mt-4">
                <span className="valor text-3xl">
                  {plano.precoMensal === 0 ? "R$ 0" : formatarMoeda(plano.precoMensal)}
                </span>
                <span className="text-sm" style={{ color: "var(--tinta-suave)" }}>
                  {plano.precoMensal === 0 ? " para sempre" : " / mês"}
                </span>
              </p>
              {id === "pro" && (
                <p className="dica">
                  {formatarMoeda(plano.precoAnual)}/mês no anual · economiza{" "}
                  {formatarMoeda(economiaAnual())} por ano
                </p>
              )}

              <ul className="mt-5 flex flex-col gap-2 text-sm flex-1">
                {plano.destaques.map((d) => (
                  <li key={d} className="flex items-start gap-2">
                    <Check
                      size={15}
                      strokeWidth={3}
                      className="mt-0.5 shrink-0"
                      style={{ color: "var(--positivo)" }}
                      aria-hidden
                    />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/cadastro"
                className={`mt-6 justify-center botao${id === "free" ? " botao-secundario" : ""}`}
              >
                {id === "free" ? "Começar grátis" : "Começar e assinar depois"}
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Perguntas() {
  const perguntas = [
    {
      p: "Preciso entender de contabilidade?",
      r: "Não. Você lança o que entrou e o que saiu; o sistema organiza por categoria e monta o relatório. Quem fala a língua do contador é ele.",
    },
    {
      p: "Substitui o contador?",
      r: "Não, e nem tenta. Ele continua fazendo sua declaração — só que recebendo um relatório pronto em vez de uma sacola de papel.",
    },
    {
      p: "E se a foto da nota sair tremida?",
      r: "O sistema avisa que não conseguiu ler em vez de inventar valor. Você lança na mão em 15 segundos e segue.",
    },
    {
      p: "Alguém do AgilizeMei vê meus lançamentos?",
      r: "Não. O isolamento é feito no banco de dados, não por promessa: mesmo a equipe de operação só enxerga contagens e estado da conta, nunca descrição ou valor.",
    },
    {
      p: "O dinheiro do PIX passa por vocês?",
      r: "Nunca. O código de pagamento é gerado com a sua chave, e o valor cai direto na sua conta.",
    },
    {
      p: "Posso cancelar quando quiser?",
      r: "Pode, sem multa e sem fidelidade. Você volta para o plano grátis e seus dados continuam lá.",
    },
  ];

  return (
    <section style={{ background: "var(--papel-escuro)" }}>
      <div className="max-w-3xl mx-auto w-full px-5 py-14 md:py-20">
        <h2
          className="text-2xl md:text-3xl mb-8"
          style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}
        >
          Perguntas que todo MEI faz
        </h2>

        <div className="flex flex-col">
          {perguntas.map(({ p, r }) => (
            <details
              key={p}
              className="border-b py-4"
              style={{ borderColor: "var(--borda)" }}
            >
              <summary className="font-medium cursor-pointer list-none flex justify-between gap-4">
                {p}
                <span aria-hidden style={{ color: "var(--tinta-suave)" }}>
                  +
                </span>
              </summary>
              <p className="mt-2 text-sm" style={{ color: "var(--tinta-suave)" }}>
                {r}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function ChamadaFinal() {
  return (
    <section className="max-w-5xl mx-auto w-full px-5 py-16 md:py-24 text-center">
      <h2
        className="text-2xl md:text-4xl max-w-2xl mx-auto leading-tight"
        style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}
      >
        O próximo mês pode fechar sozinho.
      </h2>
      <p className="mt-4 max-w-xl mx-auto" style={{ color: "var(--tinta-suave)" }}>
        Crie a conta agora e lance a primeira nota antes do seu café esfriar.
      </p>
      <Link href="/cadastro" className="botao mt-8 inline-flex">
        Criar conta grátis
        <ArrowRight size={16} aria-hidden />
      </Link>
    </section>
  );
}

function Rodape() {
  return (
    <footer className="border-t" style={{ borderColor: "var(--borda)" }}>
      <div className="max-w-5xl mx-auto w-full px-5 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <Marca tamanho="pequeno" />
        <p className="text-xs text-center" style={{ color: "var(--tinta-suave)" }}>
          Feito para o microempreendedor brasileiro.
        </p>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/login">Entrar</Link>
          <Link href="/cadastro" className="font-medium">
            Criar conta
          </Link>
        </div>
      </div>
    </footer>
  );
}
