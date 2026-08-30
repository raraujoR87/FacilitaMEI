"use client";

import { useActionState } from "react";
import { atualizarPerfil } from "@/app/actions/perfil";
import { ESTADO_INICIAL } from "@/app/actions/tipos";
import { Aviso, Campo, CampoSelect } from "@/components/ui/campos";
import { BotaoSubmit } from "@/components/ui/botao-submit";

export type Perfil = {
  nome_negocio: string;
  cnpj: string | null;
  telefone_whatsapp: string | null;
  chave_pix: string | null;
  tipo_chave_pix: string | null;
  nome_titular_pix: string | null;
  cidade_pix: string | null;
};

const TIPOS_CHAVE = [
  { valor: "cpf", rotulo: "CPF" },
  { valor: "cnpj", rotulo: "CNPJ" },
  { valor: "email", rotulo: "E-mail" },
  { valor: "telefone", rotulo: "Telefone" },
  { valor: "aleatoria", rotulo: "Chave aleatória" },
];

export function FormularioPerfil({ perfil }: { perfil: Perfil }) {
  const [estado, acao] = useActionState(atualizarPerfil, ESTADO_INICIAL);

  return (
    <form action={acao} className="flex flex-col gap-8">
      <section className="fita-recibo px-6 py-6 flex flex-col gap-4">
        <p className="text-xs uppercase tracking-widest" style={{ color: "var(--tinta-suave)" }}>
          Seu negócio
        </p>
        <Campo
          nome="nome_negocio"
          label="Nome do negócio"
          obrigatorio
          valorInicial={perfil.nome_negocio}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo nome="cnpj" label="CNPJ" valorInicial={perfil.cnpj} inputMode="numeric" />
          <Campo
            nome="telefone_whatsapp"
            label="WhatsApp do negócio"
            tipo="tel"
            inputMode="tel"
            valorInicial={perfil.telefone_whatsapp}
            dica="Usado para identificar as notas que você mandar por WhatsApp."
          />
        </div>
      </section>

      <section className="fita-recibo px-6 py-6 flex flex-col gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest" style={{ color: "var(--tinta-suave)" }}>
            Recebimento por PIX
          </p>
          <p className="dica">
            Com esses dados o sistema gera o código de pagamento de cada
            cobrança. O dinheiro cai direto na sua conta — o FacilitaMEI não
            fica no meio.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
          <CampoSelect
            nome="tipo_chave_pix"
            label="Tipo da chave"
            opcoes={TIPOS_CHAVE}
            valorInicial={perfil.tipo_chave_pix}
            vazio="Escolha"
          />
          <Campo nome="chave_pix" label="Chave PIX" valorInicial={perfil.chave_pix} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            nome="nome_titular_pix"
            label="Nome do titular"
            valorInicial={perfil.nome_titular_pix}
            dica="Como aparece na sua conta bancária."
          />
          <Campo nome="cidade_pix" label="Cidade" valorInicial={perfil.cidade_pix} />
        </div>
      </section>

      <Aviso estado={estado} />

      <div className="flex justify-end">
        <BotaoSubmit>Salvar</BotaoSubmit>
      </div>
    </form>
  );
}
