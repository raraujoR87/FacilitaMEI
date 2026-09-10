"use client";

import { useActionState } from "react";
import { Building2 } from "lucide-react";
import { atualizarDadosDaEmpresa } from "@/app/actions/empresa";
import { ESTADO_INICIAL } from "@/app/actions/tipos";
import { Aviso, Campo } from "@/components/ui/campos";
import { BotaoSubmit } from "@/components/ui/botao-submit";

export type DadosEmpresa = {
  endereco: string | null;
  email_contato: string | null;
  assinatura_nome: string | null;
  assinatura_titulo: string | null;
};

/**
 * O que aparece no cabeçalho e no rodapé dos documentos.
 *
 * Não é burocracia de cadastro: sem endereço e contato, a proposta sai
 * sem como o cliente responder ou conferir com quem está falando — e
 * proposta sem remetente completo parece rascunho.
 */
export function DadosDaEmpresa({
  dados,
  nomeNegocio,
}: {
  dados: DadosEmpresa;
  /** Usado como exemplo de quem assina, quando o campo está vazio. */
  nomeNegocio: string;
}) {
  const [estado, acao] = useActionState(atualizarDadosDaEmpresa, ESTADO_INICIAL);

  return (
    <section>
      <h2 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
        <Building2 size={15} aria-hidden />
        Dados nos documentos
      </h2>

      <form
        action={acao}
        className="rounded-lg border px-5 py-4 flex flex-col gap-4"
        style={{ borderColor: "var(--borda)", background: "#fff" }}
      >
        <p className="text-sm" style={{ color: "var(--tinta-suave)" }}>
          Entram no cabeçalho do orçamento em PDF, junto com o logo e o
          CNPJ que você já cadastrou acima.
        </p>

        <Campo
          nome="endereco"
          label="Endereço"
          valorInicial={dados.endereco}
          placeholder="Rua, número, bairro"
          dica="Cidade e estado já vêm do cadastro acima."
        />

        <Campo
          nome="email_contato"
          label="E-mail de contato"
          tipo="email"
          inputMode="email"
          valorInicial={dados.email_contato}
          dica="Por onde o cliente responde à proposta."
        />

        <div
          className="pt-4 border-t grid gap-4 sm:grid-cols-2"
          style={{ borderColor: "var(--borda)" }}
        >
          <Campo
            nome="assinatura_nome"
            label="Quem assina"
            valorInicial={dados.assinatura_nome}
            placeholder={nomeNegocio}
            dica="Vazio, assina com o nome do negócio."
          />
          <Campo
            nome="assinatura_titulo"
            label="Cargo ou profissão"
            valorInicial={dados.assinatura_titulo}
            placeholder="Ex: Eletricista · CREA 123456"
          />
        </div>

        <Aviso estado={estado} />

        <div className="flex justify-end">
          <BotaoSubmit carregando="Salvando...">Salvar</BotaoSubmit>
        </div>
      </form>
    </section>
  );
}
