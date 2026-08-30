import Link from "next/link";
import type { Metadata } from "next";
import { Marca } from "@/components/ui/marca";

export const metadata: Metadata = {
  title: "Política de Privacidade — AgilizeMei",
  description: "Como o AgilizeMei trata os dados de quem usa e dos clientes cadastrados.",
};

/**
 * Documento jurídico escrito a partir do que o sistema realmente faz.
 *
 * Não substitui revisão de advogado — sobretudo por descrever tratamento de
 * dados de terceiros (os clientes do MEI), que é a parte de maior exposição.
 */
export default function PrivacidadePage() {
  const contato = process.env.NEXT_PUBLIC_EMAIL_CONTATO;

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
          Política de Privacidade
        </h1>
        <p className="dica mb-8">
          Última atualização: agosto de 2026. Escrita em linguagem direta de
          propósito — se algo aqui não estiver claro, é falha nossa.
        </p>

        <Secao titulo="Quem é responsável pelos dados">
          <p>
            O AgilizeMei é o controlador dos dados tratados nesta plataforma,
            nos termos da Lei Geral de Proteção de Dados (Lei 13.709/2018).
          </p>
          {contato ? (
            <p>
              Para qualquer assunto de privacidade, escreva para{" "}
              <a href={`mailto:${contato}`} className="underline">
                {contato}
              </a>
              .
            </p>
          ) : (
            <p>
              O canal de contato para assuntos de privacidade deve constar
              aqui. Se você está lendo isto, ele ainda não foi configurado.
            </p>
          )}
        </Secao>

        <Secao titulo="O que coletamos">
          <p>
            <strong>Da sua conta:</strong> e-mail e senha (guardada apenas como
            hash, nunca em texto), nome do negócio, CNPJ, telefone de WhatsApp,
            chave PIX e município.
          </p>
          <p>
            <strong>Do seu movimento financeiro:</strong> lançamentos de entrada
            e saída, recibos, orçamentos, itens, valores, datas e as imagens de
            notas que você enviar.
          </p>
          <p>
            <strong>Dos seus clientes:</strong> nome, CPF ou CNPJ, telefone e
            e-mail — quando você os cadastra. Esses dados são de terceiros, e
            você responde por ter base legal para tratá-los. Nós os guardamos
            para gerar seus recibos e dizer quando a nota fiscal é obrigatória.
          </p>
        </Secao>

        <Secao titulo="Para que usamos">
          <p>
            Exclusivamente para operar o serviço: registrar seu movimento,
            emitir recibos, gerar código PIX, montar relatórios e avisar sobre
            obrigações fiscais. <strong>Não vendemos dados</strong>, não
            compartilhamos com anunciantes e não usamos seu movimento
            financeiro para treinar modelos de inteligência artificial.
          </p>
        </Secao>

        <Secao titulo="Com quem compartilhamos">
          <p>
            Apenas com a infraestrutura necessária para o serviço existir:
          </p>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li>
              <strong>Supabase</strong> — banco de dados e autenticação, com os
              dados hospedados em São Paulo.
            </li>
            <li>
              <strong>Vercel</strong> — hospedagem da aplicação.
            </li>
            <li>
              <strong>Anthropic ou Google</strong> — quando você envia a foto de
              uma nota, a imagem é processada por um desses serviços de
              inteligência artificial para extrair valor, data e fornecedor. É o
              único momento em que um dado seu sai da nossa infraestrutura, e só
              acontece se você escolher usar essa função.
            </li>
          </ul>
          <p>
            O código PIX é gerado dentro do próprio sistema, com a sua chave. O
            dinheiro nunca passa por nós.
          </p>
        </Secao>

        <Secao titulo="Seus direitos">
          <p>
            A LGPD garante, entre outros, o direito de acessar, corrigir,
            portar e excluir seus dados. No AgilizeMei isso não depende de
            pedir por e-mail:
          </p>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li>
              <strong>Acesso e portabilidade:</strong> em Configurações você
              baixa um arquivo com tudo o que temos sobre você, em formato
              aberto.
            </li>
            <li>
              <strong>Correção:</strong> os dados do negócio são editáveis a
              qualquer momento na própria tela de Configurações.
            </li>
            <li>
              <strong>Exclusão:</strong> também em Configurações, e o efeito é
              imediato — apaga a conta e tudo que está ligado a ela.
            </li>
          </ul>
        </Secao>

        <Secao titulo="Por quanto tempo guardamos">
          <p>
            Enquanto sua conta existir. Ao excluí-la, os dados são removidos do
            banco na hora. Cópias em backup de infraestrutura podem persistir
            por um período curto até serem sobrescritas.
          </p>
          <p>
            Documentos fiscais têm prazos legais de guarda próprios. Excluir a
            conta aqui não substitui a sua obrigação de manter os documentos
            pelo prazo que a legislação exigir — por isso vale exportar antes.
          </p>
        </Secao>

        <Secao titulo="Segurança">
          <p>
            Cada conta é isolada no banco de dados por políticas de nível de
            linha: um usuário não alcança o dado de outro, mesmo que tente. A
            equipe de operação vê contagens e estado das contas para dar
            suporte, mas <strong>não vê descrição, valor nem comprovante</strong>{" "}
            do seu movimento — essa restrição é aplicada pelo banco.
          </p>
          <p>
            Os comprovantes que você envia ficam em armazenamento privado,
            separado por conta.
          </p>
        </Secao>

        <p className="dica mt-10">
          Dúvidas sobre este documento antes de aceitar? Não crie conta e fale
          com a gente primeiro.{" "}
          <Link href="/termos" className="underline">
            Ver os termos de uso
          </Link>
          .
        </p>
      </main>

      <footer className="border-t" style={{ borderColor: "var(--borda)" }}>
        <div className="max-w-3xl mx-auto w-full px-5 py-6 flex gap-4 text-sm">
          <Link href="/">Início</Link>
          <Link href="/termos">Termos de uso</Link>
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
