import Link from "next/link";
import type { Metadata } from "next";
import { Marca } from "@/components/ui/marca";
import { PLANOS } from "@/lib/planos";
import { formatarMoeda } from "@/lib/formato";

export const metadata: Metadata = {
  title: "Termos de Uso — AgilizeMei",
  description: "As regras de uso do AgilizeMei, em linguagem direta.",
};

/**
 * Termos escritos a partir do que o produto realmente faz e não faz.
 *
 * A limitação mais importante está na seção fiscal: o app orienta, não
 * emite nota e não substitui contador. Prometer o contrário criaria
 * responsabilidade que o produto não tem como honrar.
 */
export default function TermosPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b" style={{ borderColor: "var(--borda)" }}>
        <div className="max-w-3xl mx-auto w-full px-5 py-4">
          <Link href="/">
            <Marca />
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto w-full px-5 py-10 flex-1">
        <h1
          className="text-2xl md:text-3xl mb-2"
          style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}
        >
          Termos de Uso
        </h1>
        <p className="dica mb-8">Última atualização: agosto de 2026.</p>

        <Secao titulo="O que o AgilizeMei é">
          <p>
            Uma ferramenta de organização financeira para microempreendedores:
            registra entradas e saídas, emite recibos e orçamentos, gera código
            PIX de cobrança e monta relatórios.
          </p>
        </Secao>

        <Secao titulo="O que o AgilizeMei não é">
          <p>
            <strong>Não emitimos nota fiscal.</strong> O app indica quando a
            nota é obrigatória e onde emiti-la, mas a emissão é ato seu, feita
            nos portais do governo.
          </p>
          <p>
            <strong>Não somos seu contador.</strong> As orientações fiscais aqui
            são informativas e seguem a legislação vigente na data em que foram
            escritas. Regra fiscal muda. Antes de decidir sobre um caso
            concreto, confirme com um profissional de contabilidade.
          </p>
          <p>
            <strong>Não somos instituição de pagamento.</strong> O código PIX é
            gerado com a sua chave e o valor cai direto na sua conta. Nenhum
            dinheiro passa por nós, e não intermediamos cobrança.
          </p>
        </Secao>

        <Secao titulo="Sua responsabilidade">
          <p>
            Você responde pela veracidade do que registra e por manter a guarda
            dos seus documentos fiscais pelos prazos legais. Ao cadastrar dados
            de clientes, você declara ter base legal para tratá-los.
          </p>
          <p>
            A conta é pessoal. Compartilhar acesso é decisão sua, e o que
            acontecer sob o seu login é de sua responsabilidade.
          </p>
        </Secao>

        <Secao titulo="Planos e pagamento">
          <p>
            O plano grátis permite {PLANOS.free.limiteNotas} notas lidas por
            foto no mês; lançamentos manuais são ilimitados nos dois planos. O
            plano Pro custa {formatarMoeda(PLANOS.pro.precoMensal)} por mês, ou{" "}
            {formatarMoeda(PLANOS.pro.precoAnual)} por mês na assinatura anual.
          </p>
          <p>
            <strong>Sem fidelidade e sem multa.</strong> Cancelando, você volta
            ao plano grátis ao fim do período já pago e seus dados continuam
            acessíveis. Nada é apagado por cancelamento.
          </p>
          <p>
            A leitura de notas por inteligência artificial no plano Pro é de uso
            justo: volumes muito acima do padrão de um MEI podem ser limitados,
            e avisaremos antes se isso acontecer.
          </p>
        </Secao>

        <Secao titulo="Disponibilidade">
          <p>
            Fazemos o possível para manter o serviço no ar, mas não prometemos
            disponibilidade ininterrupta. Exporte seus dados periodicamente — a
            função está em Configurações e leva um clique.
          </p>
        </Secao>

        <Secao titulo="Encerramento">
          <p>
            Você pode excluir sua conta a qualquer momento, direto no app, sem
            precisar pedir. Podemos encerrar contas que usem o serviço para
            fraude ou que violem estes termos.
          </p>
        </Secao>

        <Secao titulo="Mudanças nestes termos">
          <p>
            Se algo mudar de forma relevante, avisaremos pelo próprio app antes
            de valer. Continuar usando depois disso significa concordar.
          </p>
        </Secao>

        <p className="dica mt-10">
          <Link href="/privacidade" className="underline">
            Ver a política de privacidade
          </Link>
        </p>
      </main>

      <footer className="border-t" style={{ borderColor: "var(--borda)" }}>
        <div className="max-w-3xl mx-auto w-full px-5 py-6 flex gap-4 text-sm">
          <Link href="/">Início</Link>
          <Link href="/privacidade">Privacidade</Link>
        </div>
      </footer>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mb-7">
      <h2 className="font-semibold mb-2">{titulo}</h2>
      <div className="flex flex-col gap-2 text-sm" style={{ color: "var(--tinta-suave)" }}>
        {children}
      </div>
    </section>
  );
}
